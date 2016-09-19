package db

import (
	"encoding/json"
	"graph"
	"io"
	"os"
	"sync"
	"time"
)

type Claims map[string]interface{}

type M struct {
	Timestamp time.Time              `json:"t,omitempty"`
	Claims    Claims                 `json:"c,omitempty"`
	Query     string                 `json:"q,omitempty"`
	Params    map[string]interface{} `json:"p:omitempty"`
}

type DB struct {
	g *graph.Graph
	sync.RWMutex
	conns []*Conn
	log   io.ReadWriter
}

func (db *DB) commit(g *graph.Graph, mutations []*M) error {
	db.Lock()
	defer db.Unlock()
	enc := json.NewEncoder(db.log)
	for _, m := range mutations {
		err := enc.Encode(m)
		if err != nil {
			return err
		}
	}
	db.g = g
	// overwrite unwritten changes on all connections
	// TODO: try to merge changes
	for _, c := range db.conns {
		c.update(db.g)
		c.log = []*M{}
	}
	return nil
}

func (db *DB) closeConnection(conn *Conn) error {
	db.Lock()
	defer db.Unlock()
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

func (db *DB) NewConnection(claims Claims) (*Conn, error) {
	db.RLock()
	defer db.RUnlock()
	c := &Conn{
		db:     db,
		g:      db.g,
		claims: claims,
	}
	db.conns = append(db.conns, c)
	return c, nil
}

func (db *DB) apply(m *M) error {
	c, err := db.NewConnection(m.Claims)
	if err != nil {
		return err
	}
	defer c.Close()
	c.ExecWithParams(m.Query, m.Params) //TODO: handle errors!
	db.g = c.g
	return nil
}

// replay reads each log entry, decodes it and applies it
func (db *DB) replay() error {
	dec := json.NewDecoder(db.log)
	for {
		var m M
		if err := dec.Decode(&m); err == io.EOF {
			return nil
		} else if err != nil {
			return err
		}
		err := db.apply(&m)
		if err != nil {
			return err
		}
	}
	return nil
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

func New(w io.ReadWriter) (*DB, error) {
	db := &DB{
		g:   graph.New(),
		log: w,
	}
	if err := db.replay(); err != nil {
		return nil, err
	}
	return db, nil
}

func Open(path string) (*DB, error) {
	if _, err := os.Stat(path); os.IsNotExist(err) {
		f, err := os.Create(path)
		if err != nil {
			return nil, err
		}
		f.Close()
	}

	f, err := os.OpenFile(path, os.O_APPEND|os.O_RDWR, 0600)
	if err != nil {
		return nil, err
	}
	return New(f)
}
