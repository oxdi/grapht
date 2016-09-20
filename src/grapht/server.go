package main

import (
	"fmt"
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
	e.POST("/apps", WrapClaims(apps.CreateHandler))
	e.POST("/sessions", WrapClaims(sessions.CreateHandler))
	// Socket api
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
