package main

import (
	"db"
	"fmt"
	"os"
	"path/filepath"
	"sync"
)

var databases = &DBCollection{
	DataDir: "./data/",
	dbs:     map[string]*db.DB{},
}

type DBCollection struct {
	DataDir string // path to database storage
	dbs     map[string]*db.DB
	sync.RWMutex
}

func (dc *DBCollection) path(name string) string {
	if name == "" {
		panic("name cannot be empty")
	}
	p := filepath.Join(dc.DataDir, name)
	p, err := filepath.Abs(p)
	if err != nil {
		panic("bad path")
	}
	p = filepath.Clean(p)
	fmt.Println("dbpath:", p)

	return p
}

func (dc *DBCollection) Create(name string) (*db.DB, error) {
	if dc.Exists(name) {
		return nil, fmt.Errorf("database already exists with that name")
	}
	return dc.open(name)
}

func (dc *DBCollection) Destroy(name string) error {
	d := dc.dbs[name]
	if d != nil {
		d.Close()
		delete(dc.dbs, name)
	}
	return os.Remove(dc.path(name))
}

func (dc *DBCollection) Get(name string) (*db.DB, error) {
	d := dc.get(name)
	if d != nil {
		return d, nil
	}
	if dc.Exists(name) {
		return dc.open(name)
	}
	return nil, fmt.Errorf("not found")
}

func (dc *DBCollection) Exists(name string) bool {
	if _, err := os.Stat(dc.path(name)); err != nil {
		return false
	}
	return true
}

func (dc *DBCollection) open(name string) (*db.DB, error) {
	dc.Lock()
	defer dc.Unlock()
	// check cache
	d, ok := dc.dbs[name]
	if ok {
		return d, nil
	}
	// open
	d, err := db.Open(dc.path(name))
	if err != nil {
		return nil, err
	}
	// cache
	dc.dbs[name] = d
	return d, nil
}

func (dc *DBCollection) get(name string) *db.DB {
	dc.RLock()
	defer dc.RUnlock()
	return dc.dbs[name]
}
