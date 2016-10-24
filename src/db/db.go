package db

import (
	"encoding/json"
	"fmt"
	"graph"
	"io"
	"os"
	"path/filepath"
	"sync"
	"time"
)

type Claims map[string]interface{}

type M struct {
	Timestamp time.Time              `json:"t,omitempty"`
	Claims    Claims                 `json:"c,omitempty"`
	Query     string                 `json:"q,omitempty"`
	Params    map[string]interface{} `json:"p,omitempty"`
}

type Config struct {
	Path      string
	ImageHost string
}

type DB struct {
	g *graph.Graph
	sync.RWMutex
	conns []*Conn
	log   io.ReadWriter
	cfg   Config
	Name  string
}

func (db *DB) commit(mutations []*M) error {
	db.Lock()
	defer db.Unlock()
	enc := json.NewEncoder(db.log)
	for _, m := range mutations {
		fmt.Println("calling db.apply", m)
		if err := db.apply(m); err != nil {
			return err
		}
		if err := enc.Encode(m); err != nil {
			return err
		}
	}
	// rebase graph on all connections
	for _, c := range db.conns {
		err := c.rebase(db.g)
		if err != nil {
			fmt.Println("a connection could not be rebased so will be reset (unpublished changes will be lost)")
		}
		if c.OnChange != nil {
			fmt.Println("calling on change for", c)
			c.OnChange()
		}
	}
	fmt.Println("done committing")
	return nil
}

func (db *DB) closeConnection(conn *Conn) error {
	db.Lock()
	defer db.Unlock()
	return db.closeConnectionWithoutLock(conn)
}

func (db *DB) closeConnectionWithoutLock(conn *Conn) error {
	conns := []*Conn{}
	for _, c := range db.conns {
		if c == conn {
			continue
		}
		conns = append(conns, c)
	}
	db.conns = conns
	return nil
}

func (db *DB) NewConnection(claims Claims, tokens []*Token) (*Conn, error) {
	db.RLock()
	defer db.RUnlock()
	return db.newConnection(claims, tokens)
}

func (db *DB) newConnection(claims Claims, tokens []*Token) (*Conn, error) {
	c := &Conn{
		db:     db,
		g:      db.g,
		claims: claims,
		tokens: tokens,
	}
	db.conns = append(db.conns, c)
	return c, nil
}

func (db *DB) apply(m *M) error {
	c, err := db.newConnection(m.Claims, nil)
	if err != nil {
		return err
	}
	defer c.close()
	fmt.Println("calling c.apply")
	if err := c.apply(m); err != nil {
		fmt.Println("done c.apply (fail)")
		return err
	}
	fmt.Println("done c.apply")
	db.g = c.g
	return nil
}

// replay reads each log entry, decodes it and applies it
func (db *DB) replay() error {
	return db.decode(db.log, db.apply)
}

func (db *DB) decode(log io.Reader, apply func(m *M) error) error {
	dec := json.NewDecoder(log)
	for {
		var m M
		if err := dec.Decode(&m); err == io.EOF {
			return nil
		} else if err != nil {
			return err
		}
		err := apply(&m)
		if err != nil {
			return err
		}
	}
	return nil
}

func (db *DB) GetMutations(before time.Time, after time.Time) ([]*M, error) {
	muts := []*M{}
	log, err := db.newLogReader()
	if err != nil {
		return nil, err
	}
	err = db.decode(log, func(m *M) error {
		muts = append(muts, m)
		return nil
	})
	if err != nil {
		return nil, err
	}
	return muts, nil
}

func (db *DB) GetNode(id string) *graph.Node {
	return db.g.Get(id)
}

func (db *DB) Close() error {
	cs := db.conns
	for _, c := range cs {
		db.closeConnection(c)
	}
	if f, ok := db.log.(io.Closer); ok {
		f.Close()
	}
	return nil
}

func (db *DB) newLogReader() (io.Reader, error) {
	log, err := os.Open(db.cfg.Path)
	if err != nil {
		return nil, err
	}
	return log, nil
}

func Open(cfg Config) (*DB, error) {
	if _, err := os.Stat(cfg.Path); os.IsNotExist(err) {
		f, err := os.Create(cfg.Path)
		if err != nil {
			return nil, err
		}
		f.Close()
	}
	f, err := os.OpenFile(cfg.Path, os.O_APPEND|os.O_RDWR, 0600)
	if err != nil {
		return nil, err
	}
	db := &DB{
		g:    graph.New(),
		log:  f,
		cfg:  cfg,
		Name: filepath.Base(cfg.Path),
	}
	if db.Name == "" || db.Name == "." {
		return nil, fmt.Errorf("invalid db.Name: %s", db.Name)
	}
	if err := db.replay(); err != nil {
		return nil, err
	}
	return db, nil
}
