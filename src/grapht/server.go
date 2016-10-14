package main

import (
	"db"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/facebookgo/grace/gracehttp"
	"github.com/labstack/echo"
	"github.com/labstack/echo/engine/standard"
	"github.com/labstack/echo/middleware"
)

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
	dataHash     uint32
}

type HandlerWithClaims func(echo.Context, Claims) error

func WrapClaims(h HandlerWithClaims) echo.HandlerFunc {
	return func(c echo.Context) error {
		// get Authorization header
		auth := c.Request().Header().Get("Authorization")
		if auth == "" {
			return fmt.Errorf("missing Authorization header")
		}
		parts := strings.SplitN(auth, "Bearer", 2)
		if len(parts) < 2 {
			return fmt.Errorf("invalid Authorization header %v", parts)
		}
		token := strings.TrimSpace(parts[1])
		// Decode user token
		claims, err := DecodeClaims(token)
		if err != nil {
			fmt.Println("badtoken", token)
			return err
		}
		return h(c, claims)
	}
}

func fetchImage(c echo.Context) error {
	app, err := apps.open(c.Param("appID"))
	if err != nil {
		return err
	}
	node := app.DB.GetNode(c.Param("nodeID"))
	if node == nil {
		return fmt.Errorf("no node")
	}
	attr := node.Attr(c.Param("attrName"))
	if attr == nil {
		return fmt.Errorf("no attr")
	}
	if attr.Value == "" {
		return fmt.Errorf("no data")
	}
	r, err := db.NewImageDataReader(attr.Value)
	if err != nil {
		return err
	}
	c.Response().WriteHeader(http.StatusOK)
	io.Copy(c.Response(), r)
	return nil
}

func StartServer() error {
	e := echo.New()
	e.Use(middleware.CORS())
	e.SetDebug(true)

	// Middleware
	e.Use(middleware.Logger())
	e.Use(middleware.Recover())

	// REST api
	e.POST("/authenticate", users.AuthenticateHandler)
	e.POST("/register", users.CreateHandler)
	e.GET("/user", WrapClaims(users.GetHandler))
	e.GET("/assets/:appID/:nodeID/:attrName", fetchImage)
	e.POST("/apps", WrapClaims(apps.CreateHandler))
	e.POST("/sessions", WrapClaims(sessions.CreateHandler))
	// Socket api
	e.GET("/connect", sessions.ConnectHandler)

	// admin ui
	e.GET("/*", static)

	// Restricted routes
	// api := e.Group("/api")
	// api.Use(middleware.JWT([]byte(AUTH_SECRET)))

	std := standard.New(fmt.Sprintf("0.0.0.0:%d", SERVER_PORT))
	std.SetHandler(e)
	return gracehttp.Serve(std.Server)
}
