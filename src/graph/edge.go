package graph

import "fmt"

type edge struct {
	name string
	from string
	to string
	attrs map[string]string
	hasOne bool
	onDelete func(e *Edge) *Graph
}

type Edges []*Edge

func (es Edges) Get(name string) Nodes {
	nodes := Nodes{}
	for _, e := range es {
		if e.e.name == name {
			nodes = append(nodes, e.Node())
		}
	}
	return nodes
}

func (es Edges) First() *Node {
	if len(es) == 0 {
		return nil
	}
	return es[0].Node()
}

type Edge struct {
	g *Graph
	e *edge
	in bool
}

func (e *Edge) Node() *Node {
	if e.in {
		return e.g.Get(e.e.from)
	}
	return e.g.Get(e.e.to)
}

type EdgeConfig struct {
	Name string
	From string
	To string
	HasOne bool
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

func Cascade(e *Edge) *Graph {
	return e.g.Remove(e.e.to)
}

