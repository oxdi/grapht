package db

import (
	"encoding/json"
	"graph"
	"io"
	"os"
	"sync"
	"time"
)

type M struct {
	T time.Time              // Timestamp
	U string                 // Uid
	Q string                 // Query
	P map[string]interface{} // Query params
}

type DB struct {
	g *graph.Graph
	sync.RWMutex
	conns []*Conn
	log   io.ReadWriter
}

func (db *DB) commit(g *graph.Graph, mutations []string, uid string) error {
	db.Lock()
	defer db.Unlock()
	db.g = g
	enc := json.NewEncoder(db.log)
	for _, m := range mutations {
		err := enc.Encode(&M{
			T: time.Now(),
			Q: m,
			U: uid,
		})
		if err != nil {
			return err
		}
	}
	for _, c := range db.conns {
		c.update(db.g)
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

func (db *DB) NewConnection(uid string) *Conn {
	c := &Conn{
		db:  db,
		g:   db.g,
		uid: uid,
	}
	db.conns = append(db.conns, c)
	return c
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
		c := db.NewConnection(m.U)
		c.Exec(m.Q)
		db.g = c.g
		c.Close()
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
