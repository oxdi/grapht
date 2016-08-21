package db

import "graph"
import "sync"

type DB struct {
	g *graph.Graph
	sync.RWMutex
	conns []*Conn
}

func (db *DB) commit(g *graph.Graph) error {
	db.Lock()
	defer db.Unlock()
	db.g = g
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

func (db *DB) NewConnection() *Conn {
	c := &Conn{
		db: db,
		g:  db.g,
	}
	db.conns = append(db.conns, c)
	return c
}

func New() *DB {
	db := &DB{
		g: graph.New(),
	}
	db.g = db.g.DefineType(graph.Type{
		Name: "User",
	})
	return db
}
