package graph

type Attr struct {
	Name  string
	Value string
}

type Attrs map[string]string

type NodeConfig struct {
	ID    string
	Type  string
	Attrs []Attr
}

type Nodes []*Node

func (ns Nodes) First() *Node {
	if len(ns) == 0 {
		return nil
	}
	return ns[0]
}

type node struct {
	id    string
	attrs map[string]string
	t     string
}

type Node struct {
	g *Graph
	n *node
}

func (n *Node) ID() string {
	return n.n.id
}

func (n *Node) Type() *Type {
	return n.g.Type(n.n.t)
}

func (n *Node) Attr(key string) string {
	if n.n.attrs == nil {
		return ""
	}
	return n.n.attrs[key]
}

func (n *Node) Attrs() []*Attr {
	attrs := []*Attr{}
	for k, v := range n.n.attrs {
		attrs = append(attrs, &Attr{
			Name:  k,
			Value: v,
		})
	}
	return attrs
}

func (n *Node) Out(edgeName string) Edges {
	edges := Edges{}
	for _, e := range n.g.edges {
		if e.from != n.n.id {
			continue
		}
		if edgeName != "" && e.name != edgeName {
			continue
		}
		edges = append(edges, &Edge{
			e: e,
			g: n.g,
		})
	}
	return edges
}

func (n *Node) In(edgeName string) []*Edge {
	edges := Edges{}
	for _, e := range n.g.edges {
		if e.to != n.n.id {
			continue
		}
		if edgeName != "" && e.name != edgeName {
			continue
		}
		edges = append(edges, &Edge{
			in: true,
			e:  e,
			g:  n.g,
		})
	}
	return edges
}
