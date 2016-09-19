package main

import (
	"db"
	"fmt"
	"net/http"
	"sync"
	"uuid"

	"github.com/labstack/echo"
	"github.com/labstack/echo/engine/standard"

	"golang.org/x/net/websocket"
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
			go onChange()
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

func (s SessionCollection) Get(id string) (*Session, error) {
	for _, session := range s.sessions {
		if session.ID == id {
			return session, nil
		}
	}
	return nil, fmt.Errorf("no session found")
}

func (sc *SessionCollection) Create(sid string, sessionClaims Claims) (*Session, error) {
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

func (sc *SessionCollection) GetHandler(c echo.Context) error {
	id := c.Param("id")
	if id == "" {
		return fmt.Errorf("id path param is required")
	}
	app, _ := apps.Get(id)
	if app == nil {
		return fmt.Errorf("only guest app sessions can be fetched")
	}
	session, err := sc.Get(id)
	if err != nil {
		return err
	}
	if session == nil {
		return fmt.Errorf("nil session")
	}
	guestClaims := Claims{
		"uid": "guest",
		"aid": id,
		"sid": id,
	}
	t, err := EncodeClaims(guestClaims)
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

func (sc *SessionCollection) CreateHandler(c echo.Context) error {
	params := &struct {
		UserToken string `json:"userToken"`
		AppID     string `json:"appID"`
	}{}
	if err := c.Bind(params); err != nil {
		return err
	}
	// Validate params
	if params.UserToken == "" {
		return fmt.Errorf("userToken is required")
	}
	if params.AppID == "" {
		return fmt.Errorf("appID is require")
	}
	// Decode user token
	userClaims, err := DecodeClaims(params.UserToken)
	if err != nil {
		return err
	}
	// Create session claims
	sessionClaims := Claims{}
	for k, v := range userClaims {
		sessionClaims[k] = v
	}
	sessionClaims["aid"] = params.AppID
	// Create a session
	session, err := sessions.Create(uuid.TimeUUID().String(), sessionClaims)
	if err != nil {
		return err
	}
	sessionClaims["sid"] = session.ID
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
	params := &struct {
		SessionToken string `json:"sessionToken"`
	}{
		SessionToken: c.QueryParam("sessionToken"),
	}
	// Validate params
	if params.SessionToken == "" {
		return fmt.Errorf("sessionToken is required")
	}
	// Decode user token
	sessionClaims, err := DecodeClaims(params.SessionToken)
	if err != nil {
		return err
	}
	// Lookup the session
	session, err := sessionClaims.Session()
	if err != nil {
		return err
	}
	// call the websocket handler
	return standard.WrapHandler(websocket.Handler(func(ws *websocket.Conn) {
		client := session.Connect(ws)
		defer func() {
			session.Disconnect(client)
		}()
		err := client.AcceptLoop()
		if err != nil {
			fmt.Println("socket closed unexpectly", err)
		}
	}))(c)
}

var sessions = &SessionCollection{
	sessions: []*Session{},
}
