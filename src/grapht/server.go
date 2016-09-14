package main

import (
	"db"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	"golang.org/x/net/websocket"

	jwt "github.com/dgrijalva/jwt-go"
	"github.com/facebookgo/grace/gracehttp"
	"github.com/labstack/echo"
	"github.com/labstack/echo/engine/standard"
	"github.com/labstack/echo/middleware"
)

// connect(jwt, appid) => ws + admin api + public api for appid
// connect(nil, appid) => ws + public api for appid
// connect(jwt, nil) => ws + admin api, no client api

type LoginReq struct {
	Username string `json:"username"`
	Password string `json:"password"`
	AppID    string `json:"aid"`
}

func authenticate(uid, password, aid string) (string, string, *db.DB, error) {
	fmt.Println("AUTHINFO u=", uid, "p=", password, "aid=", aid)
	// get db
	db, err := databases.Get(aid)
	if err != nil {
		return "", "", nil, fmt.Errorf("invalid app id")
	}
	// get user node
	c := db.NewConnection("")
	defer c.Close()
	results := c.QueryWithParams(`
		query Q($id:ID!){
			node(id:$id){
				...on User {
					id
					password
				}
			}
		}
	`, map[string]interface{}{
		"id": uid,
	})
	if len(results.Errors) > 0 {
		return "", "", nil, results.Errors[0]
	}
	data, ok := results.Data.(map[string]interface{})
	if !ok {
		return "", "", nil, fmt.Errorf("failed to get user")
	}
	node, ok := data["node"].(map[string]interface{})
	if !ok {
		return "", "", nil, fmt.Errorf("failed to get user")
	}
	username, ok := node["id"]
	if !ok {
		return "", "", nil, fmt.Errorf("failed to get user id")
	}
	if username != uid {
		return "", "", nil, fmt.Errorf("failed to get correct user node")
	}
	hashedPassword, ok := node["password"]
	if !ok {
		return "", "", nil, fmt.Errorf("failed to get user password")
	}
	// Check password
	if password != hashedPassword {
		return "", "", nil, fmt.Errorf("invalid password")
	}
	// Create token
	t, err := createToken(uid, aid)
	if err != nil {
		return "", "", nil, err
	}
	return t, uid, db, nil
}

func createToken(uid, aid string) (string, error) {
	token := jwt.New(jwt.SigningMethodHS256)
	claims := token.Claims.(jwt.MapClaims)
	claims["exp"] = time.Now().Add(time.Hour * 72).Unix()
	claims["uid"] = uid
	claims["aid"] = aid
	return token.SignedString([]byte(AUTH_SECRET))
}

type QueryReq struct {
	Query  string
	Params map[string]interface{}
}

type WireMsg struct {
	Type         string                 `json:"type,omitempty"`
	Query        string                 `json:"query,omitempty"`
	Params       map[string]interface{} `json:"params,omitempty"`
	Username     string                 `json:"username,omitempty"`
	Password     string                 `json:"password,omitempty"`
	AppID        string                 `json:"appID,omitempty"`
	Token        string                 `json:"token,omitempty"`
	Error        string                 `json:"error,omitempty"`
	Tag          string                 `json:"tag,omitempty"`
	Subscription string                 `json:"subscription,omitempty"`
	Data         interface{}            `json:"data,omitempty"`
}

type conn struct {
	uid string
	db  *db.Conn
	ws  *websocket.Conn
	sync.RWMutex
	subscriptions map[string]func()
}

func recv(c *conn, msg *WireMsg) error {
	switch msg.Type {
	case "login":
		t, uid, db, err := authenticate(msg.Username, msg.Password, msg.AppID)
		if err != nil {
			return err
		}
		c.Lock()
		c.uid = uid
		c.db = db.NewConnection(uid)
		c.db.OnChange = func() {
			for _, fn := range c.subscriptions {
				fn()
			}
		}
		c.Unlock()
		err = send(c.ws, &WireMsg{
			Tag:   msg.Tag,
			Type:  "token",
			Token: t,
		})
		if err != nil {
			return err
		}
	case "token":
		token, err := jwt.Parse(msg.Token, func(token *jwt.Token) (interface{}, error) {
			return []byte(AUTH_SECRET), nil
		})
		if claims, ok := token.Claims.(jwt.MapClaims); ok {
			c.uid = claims["uid"].(string)
			db, err := databases.Get(claims["aid"].(string))
			if err != nil {
				return fmt.Errorf("no app found for aid claim")
			}
			c.db = db.NewConnection(c.uid)
			c.db.OnChange = func() {
				for _, fn := range c.subscriptions {
					fn()
				}
			}
			err = send(c.ws, &WireMsg{
				Tag:   msg.Tag,
				Type:  "token",
				Token: msg.Token,
			})
		} else {
			err = send(c.ws, &WireMsg{
				Type: "deauth",
			})
			if err != nil {
				return err
			}
		}
	case "query":
		c.RLock()
		defer c.RUnlock()
		if c.db == nil {
			return fmt.Errorf("cannot query: not connected")
		}
		result := c.db.QueryWithParams(msg.Query, msg.Params)
		err := send(c.ws, &WireMsg{
			Tag:  msg.Tag,
			Type: "data",
			Data: result,
		})
		if err != nil {
			return err
		}
	case "exec":
		c.RLock()
		defer c.RUnlock()
		if c.db == nil {
			return fmt.Errorf("cannot exec: not connected")
		}
		result := c.db.ExecWithParams(msg.Query, msg.Params)
		err := send(c.ws, &WireMsg{
			Tag:  msg.Tag,
			Type: "data",
			Data: result,
		})
		if err != nil {
			return err
		}
	case "commit":
		c.RLock()
		defer c.RUnlock()
		if c.db == nil {
			return fmt.Errorf("cannot commit: not connected")
		}
		err := c.db.Commit()
		if err != nil {
			return fmt.Errorf("failed to commit: %s", err.Error())
		}
		err = send(c.ws, &WireMsg{
			Tag:  msg.Tag,
			Type: "ok",
		})
		if err != nil {
			return err
		}
	case "subscribe":
		c.Lock()
		defer c.Unlock()
		if c.db == nil {
			return fmt.Errorf("cannot query: not connected")
		}
		c.subscriptions[msg.Subscription] = func() {
			result := c.db.QueryWithParams(msg.Query, msg.Params)
			err := send(c.ws, &WireMsg{
				Subscription: msg.Subscription,
				Type:         "data",
				Data:         result,
			})
			if err != nil {
				senderr := send(c.ws, &WireMsg{
					Subscription: msg.Subscription,
					Type:         "error",
					Error:        err.Error(),
				})
				if senderr != nil {
					fmt.Println("SENDERR", senderr)
				}
			}
		}
		err := send(c.ws, &WireMsg{
			Tag:  msg.Tag,
			Type: "ok",
		})
		if err != nil {
			return err
		}
		c.db.OnChange()
	case "unsubscribe":
		c.Lock()
		defer c.Unlock()
		if c.db == nil {
			return fmt.Errorf("cannot query: not connected")
		}
		delete(c.subscriptions, msg.Tag)
		err := send(c.ws, &WireMsg{
			Tag:  msg.Tag,
			Type: "ok",
		})
		if err != nil {
			return err
		}
	default:
		return fmt.Errorf("unknown message type: %s", msg.Type)
	}
	return nil
}

func send(ws *websocket.Conn, msg *WireMsg) error {
	data, err := json.Marshal(msg)
	if err != nil {
		return err
	}
	if err := websocket.Message.Send(ws, string(data)); err != nil {
		return err
	}
	return nil
}

func connect() websocket.Handler {
	return websocket.Handler(func(ws *websocket.Conn) {
		c := &conn{
			ws:            ws,
			subscriptions: map[string]func(){},
		}
		defer func() {
			if c.db != nil {
				// c.db.Close()
			}
			fmt.Println("DISCONNECTED")
		}()
		fmt.Println("CONNECTED")
		for {
			var data string
			if err := websocket.Message.Receive(ws, &data); err != nil {
				fmt.Println("RECV raw err:", err)
				return
			} else {
				fmt.Println("RECV raw data:", data)
				var msg WireMsg
				if err := json.Unmarshal([]byte(data), &msg); err != nil {
					fmt.Println("RECV unmarhsal:", err)
					return
				} else {
					if err := recv(c, &msg); err != nil {
						fmt.Println("RECV response:", err)
						send(ws, &WireMsg{
							Tag:   msg.Tag,
							Type:  "error",
							Error: err.Error(),
						})
					}
				}
			}
		}
	})
}

func createDB(c echo.Context) error {
	req := struct {
		AppID    string
		Username string
		Password string
		Email    string
	}{}
	if err := c.Bind(&req); err != nil {
		return err
	}
	db, err := databases.Create(req.AppID)
	if err != nil {
		return err
	}
	conn := db.NewConnection("")
	mutations := []string{
		`
			defineType(name:"User", fields:[
				{name: "email", type:"Text"},
				{name: "password", type:"Text"},
			]) {
				name
			}
		`, `
			set(id:"guest",type:"User"){
				id
			}
		`, fmt.Sprintf(`
			set(id:"%s", type: "User", attrs: [
				{name:"email", value:"%s"},
				{name:"password", value:"%s"}
			]) {
				id
			}
		`, req.Username, req.Email, req.Password),
	}
	for _, m := range mutations {
		result := conn.Exec("mutation {" + m + "}")
		if len(result.Errors) > 0 {
			return fmt.Errorf("create failed: %s", result.Errors[0])
		}
	}
	if err := conn.Commit(); err != nil {
		return err
	}
	t, err := createToken(req.Username, req.AppID)
	if err != nil {
		return err
	}
	res := struct {
		Token string `json:"token"`
	}{
		Token: t,
	}
	return c.JSON(http.StatusCreated, res)
}

func StartServer() error {
	e := echo.New()
	e.Use(middleware.CORS())
	e.SetDebug(true)

	// Middleware
	e.Use(middleware.Logger())
	e.Use(middleware.Recover())

	// Socket api
	e.GET("/api/connect", standard.WrapHandler(connect()))

	// signup handler
	e.POST("/api/create", createDB)

	// Restricted routes
	// api := e.Group("/api")
	// api.Use(middleware.JWT([]byte(AUTH_SECRET)))

	std := standard.New(fmt.Sprintf("0.0.0.0:%d", SERVER_PORT))
	std.SetHandler(e)
	return gracehttp.Serve(std.Server)
}
