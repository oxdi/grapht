package main

import (
	"fmt"

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
}

func StartServer() error {
	e := echo.New()
	e.Use(middleware.CORS())
	e.SetDebug(true)

	// Middleware
	e.Use(middleware.Logger())
	e.Use(middleware.Recover())

	// Socket api
	e.POST("/users", users.CreateHandler)
	e.POST("/authenticate", users.AuthenticateHandler)
	e.POST("/apps", apps.CreateHandler)
	e.POST("/sessions", sessions.CreateHandler)
	e.GET("/sessions/:id", sessions.GetHandler)
	e.GET("/connect", func(c echo.Context) error {
		err := sessions.ConnectHandler(c)
		if err != nil {
			fmt.Println("CONNFAIL:", err)
		}
		return err
	})

	// admin ui
	e.GET("/*", static)

	// Restricted routes
	// api := e.Group("/api")
	// api.Use(middleware.JWT([]byte(AUTH_SECRET)))

	std := standard.New(fmt.Sprintf("0.0.0.0:%d", SERVER_PORT))
	std.SetHandler(e)
	return gracehttp.Serve(std.Server)
}
