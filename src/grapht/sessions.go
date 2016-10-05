package main

import (
	"db"
	"fmt"
	"log"
	"net/http"
	"sync"
	"uuid"

	"github.com/labstack/echo"
	"github.com/labstack/echo/engine/standard"

	"github.com/gorilla/websocket"
)

var (
	upgrader = websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool { return true },
	}
)

type Session struct {
	ID      string
	claims  Claims
	clients []*Client
	conn    *db.Conn
	sync.RWMutex
}

func (s *Session) OnChange() {
	for _, client := range s.clients {
		for _, onChange := range client.subscriptions {
			onChange()
		}
	}
}

func (s *Session) Connect(ws *websocket.Conn) *Client {
	c := &Client{
		ws:            ws,
		subscriptions: map[string]func(){},
		session:       s,
	}
	s.clients = append(s.clients, c)
	return c
}

func (s *Session) Disconnect(client *Client) {
	clients := []*Client{}
	for _, c := range s.clients {
		if c == client {
			continue
		}
		clients = append(clients, c)
	}
	s.clients = clients
}

type SessionCollection struct {
	sessions []*Session
}

func (sc SessionCollection) Get(sid string) *Session {
	for _, session := range sc.sessions {
		if session.ID == sid {
			return session
		}
	}
	return nil
}

func (sc *SessionCollection) Exists(sid string) bool {
	s := sc.Get(sid)
	return s != nil
}

func (sc *SessionCollection) Create(sid string, sessionClaims Claims) (*Session, error) {
	if !isValidID(sid) {
		return nil, fmt.Errorf("failed to create session: invalid id")
	}
	if sc.Exists(sid) {
		return nil, fmt.Errorf("failed to create session: already exists")
	}
	// Get user
	u, err := sessionClaims.User()
	if err != nil {
		return nil, err
	}
	if u == nil {
		return nil, fmt.Errorf("no claim to user")
	}
	// Get claimed app
	app, err := sessionClaims.App()
	if err != nil {
		return nil, err
	}
	if app == nil {
		return nil, fmt.Errorf("no claim to app")
	}
	// Connect to app db
	conn, err := app.DB.NewConnection(db.Claims(sessionClaims))
	if err != nil {
		return nil, err
	}
	// Create the session
	session := &Session{
		ID:     sid,
		claims: sessionClaims,
		conn:   conn,
	}
	sc.sessions = append(sc.sessions, session)
	// Add OnChange handler
	conn.OnChange = func() {
		fmt.Println("Running conn.OnChnage")
		session.OnChange()
	}
	return session, nil
}

func (sc *SessionCollection) CreateHandler(c echo.Context, userClaims Claims) error {
	params := &struct {
		AppID string `json:"appID"`
		Role  string `json:"role"`
	}{}
	if err := c.Bind(params); err != nil {
		return err
	}
	if params.AppID == "" {
		return fmt.Errorf("appID is require")
	}
	if params.Role == "" {
		params.Role = AdminRole
	}
	// Create session claims
	sessionClaims := Claims{}
	for k, v := range userClaims {
		sessionClaims[k] = v
	}
	sessionClaims["aid"] = params.AppID
	sessionClaims["role"] = params.Role
	sessionClaims["sid"] = uuid.TimeUUID().String()
	// Encode session claims
	t, err := EncodeClaims(sessionClaims)
	if err != nil {
		return err
	}
	res := struct {
		SessionToken string `json:"sessionToken"`
	}{
		SessionToken: t,
	}
	// return sessionToken
	return c.JSON(http.StatusCreated, res)
}

func (sc *SessionCollection) ConnectHandler(c echo.Context) error {
	return standard.WrapHandler(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// upgrade
		ws, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			log.Print("upgrade:", err)
			return
		}
		defer ws.Close()
		fatal := func(err error) error {
			send(ws, &WireMsg{
				Type:  "fatal",
				Error: err.Error(),
			})
			return err
		}
		// Validate params
		sessionToken := c.QueryParam("sessionToken")
		if sessionToken == "" {
			fatal(fmt.Errorf("sessionToken is required"))
			return
		}
		// Decode user token
		sessionClaims, err := DecodeClaims(sessionToken)
		if err != nil {
			fatal(err)
			return
		}
		// Lookup the session
		session, err := sessionClaims.Session()
		if err != nil {
			fatal(err)
			return
		}
		client := session.Connect(ws)
		defer func() {
			session.Disconnect(client)
		}()
		send(ws, &WireMsg{
			Type: "ok",
		})
		if err := client.AcceptLoop(); err != nil {
			fatal(err)
			return
		}

	}))(c)
}

var sessions = &SessionCollection{
	sessions: []*Session{},
}
