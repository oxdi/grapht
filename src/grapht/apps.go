package main

import (
	"db"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"sync"

	"github.com/labstack/echo"
)

type App struct {
	ID string `json:"id"`
	DB *db.DB `json:"-"`
}

var apps = &AppCollection{
	DataDir: "./data/",
	apps:    map[string]*App{},
}

type AppCollection struct {
	DataDir string // path to database storage
	apps    map[string]*App
	sync.RWMutex
}

func (ac AppCollection) path(id string) string {
	if id == "" {
		panic("id cannot be empty")
	}
	p := filepath.Join(ac.DataDir, id)
	p, err := filepath.Abs(p)
	if err != nil {
		panic("bad path")
	}
	p = filepath.Clean(p)
	fmt.Println("dbpath:", p)

	return p
}

func (ac AppCollection) Create(id string) (*App, error) {
	if ac.Exists(id) {
		return nil, fmt.Errorf("app already exists with that id")
	}
	return ac.open(id)
}

func (ac AppCollection) Destroy(id string) error {
	app := ac.apps[id]
	if app != nil {
		app.DB.Close()
		delete(ac.apps, id)
	}
	return os.Remove(ac.path(id))
}

func (ac AppCollection) Get(id string) (*App, error) {
	d := ac.get(id)
	if d != nil {
		return d, nil
	}
	if !ac.Exists(id) {
		return nil, fmt.Errorf("no app exists for id %s", id)
	}
	return ac.open(id)
}

func (ac AppCollection) Exists(id string) bool {
	if _, err := os.Stat(ac.path(id)); err != nil {
		return false
	}
	return true
}

func (ac AppCollection) open(id string) (*App, error) {
	ac.Lock()
	defer ac.Unlock()
	// check cache
	app, ok := ac.apps[id]
	if ok {
		return app, nil
	}
	// open
	database, err := db.Open(ac.path(id))
	if err != nil {
		return nil, err
	}
	// cache
	app = &App{
		ID: id,
		DB: database,
	}
	// create the guest session
	guestClaims := Claims{
		"uid": "guest",
		"aid": app.ID,
		"sid": app.ID,
	}
	ac.apps[id] = app
	_, err = sessions.Create(app.ID, guestClaims)
	if err != nil {
		return nil, err
	}
	return app, nil
}

func (ac AppCollection) get(id string) *App {
	ac.RLock()
	defer ac.RUnlock()
	return ac.apps[id]
}

func (ac AppCollection) CreateHandler(c echo.Context) error {
	params := struct {
		UserToken string `json:"userToken"`
		ID        string `json:"id"`
	}{}
	if err := c.Bind(&params); err != nil {
		return err
	}
	// Validate params
	if params.UserToken == "" {
		return fmt.Errorf("userToken is required")
	}
	if params.ID == "" {
		return fmt.Errorf("appID is required")
	}
	// Decode user token
	userClaims, err := DecodeClaims(params.UserToken)
	if err != nil {
		return err
	}
	u, err := userClaims.User()
	if err != nil {
		return err
	}
	if u == nil {
		return fmt.Errorf("invalid user")
	}
	// Create app
	app, err := ac.Create(params.ID)
	if err != nil {
		return err
	}
	return c.JSON(http.StatusCreated, app)
}
