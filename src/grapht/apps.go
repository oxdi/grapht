package main

import (
	"db"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"sync"

	"github.com/labstack/echo"
)

var validIDMatch = regexp.MustCompile(`^([A-Za-z0-9\-_])+$`)

func isValidID(id string) bool {
	if !validIDMatch.MatchString(id) {
		return false
	}
	return true
}

type App struct {
	ID string `json:"id"`
	DB *db.DB `json:"-"`
}

var apps = &AppCollection{
	DataDir: DATA_DIR,
	apps:    map[string]*App{},
}

type AppCollection struct {
	DataDir string // path to database storage
	apps    map[string]*App
	sync.RWMutex
}

func (ac AppCollection) path(id string) string {
	if !isValidID(id) {
		panic("invalid id for path")
	}
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
	if !isValidID(id) {
		return nil, fmt.Errorf("cannot create app: invalid id")
	}
	if ac.Exists(id) {
		return nil, fmt.Errorf("app already exists with that id")
	}
	return ac.open(id)
}

func (ac AppCollection) Destroy(id string) error {
	if !isValidID(id) {
		return fmt.Errorf("cannot destroy app: invalid id")
	}
	app := ac.apps[id]
	if app != nil {
		app.DB.Close()
		delete(ac.apps, id)
	}
	return os.Remove(ac.path(id))
}

func (ac AppCollection) Get(id string) (*App, error) {
	if !isValidID(id) {
		return nil, fmt.Errorf("cannot get app: invalid id")
	}
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
	if !isValidID(id) {
		return false
	}
	if _, err := os.Stat(ac.path(id)); err != nil {
		return false
	}
	return true
}

func (ac AppCollection) open(id string) (*App, error) {
	if !isValidID(id) {
		return nil, fmt.Errorf("cannot open: invalid id")
	}
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
	ac.apps[id] = app
	return app, nil
}

func (ac AppCollection) get(id string) *App {
	ac.RLock()
	defer ac.RUnlock()
	return ac.apps[id]
}

func (ac AppCollection) CreateHandler(c echo.Context, userClaims Claims) error {
	params := struct {
		ID string `json:"id"`
	}{}
	if err := c.Bind(&params); err != nil {
		return err
	}
	// Validate params
	if !isValidID(params.ID) {
		return fmt.Errorf("invalid id param")
	}
	// Get user
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
	// Grant permission to user
	if err := u.GrantAppRole(app.ID, AdminRole); err != nil {
		return err
	}
	if err := u.GrantAppRole(app.ID, GuestRole); err != nil {
		return err
	}
	return c.JSON(http.StatusCreated, app)
}
