package graph

import "fmt"

type edge struct {
	name     string
	from     string
	to       string
	attrs    map[string]string
	onDelete func(e *Edge) *Graph
}

type Edges []*Edge

func (es Edges) Nodes() Nodes {
	nodes := Nodes{}
	for _, e := range es {
		nodes = append(nodes, e.Node())
	}
	return nodes
}

func (es Edges) First() *Edge {
	if len(es) == 0 {
		return nil
	}
	return es[0]
}

type Edge struct {
	g  *Graph
	e  *edge
	in bool
}

func (e *Edge) Node() *Node {
	if e.in {
		return e.From()
	}
	return e.To()
}

func (e *Edge) To() *Node {
	return e.g.Get(e.e.to)
}

func (e *Edge) From() *Node {
	return e.g.Get(e.e.from)
}

func (e *Edge) Name() string {
	return e.e.name
}

type EdgeConfig struct {
	Name     string
	From     string
	To       string
	OnDelete func(e *Edge) *Graph
}

func (cfg *EdgeConfig) Validate() error {
	if cfg.Name == "" {
		return fmt.Errorf("invalid edge config: Name field is required")
	}
	if cfg.From == "" {
		return fmt.Errorf("invalid edge config: From field is required")
	}
	if cfg.To == "" {
		return fmt.Errorf("invalid edge config: To field is required")
	}
	return nil
}

type EdgeMatch struct {
	Name string
	From string
	To   string
}

func Cascade(e *Edge) *Graph {
	return e.g.Remove(e.e.to)
}
