package graph

func stringIn(needle string, haystack []string) bool {
	for _, s := range haystack {
		if s == needle {
			return true
		}
	}
	return false
}

type Attr struct {
	Name     string
	Value    string
	Encoding string
}

type NodeConfig struct {
	ID    string
	Type  string
	Attrs []*Attr
}

type Nodes []*Node

func (ns Nodes) First() *Node {
	if len(ns) == 0 {
		return nil
	}
	return ns[0]
}

func (ns Nodes) FilterType(types ...string) Nodes {
	if len(types) == 0 {
		return ns
	}
	if len(ns) == 0 {
		return ns
	}
	ns2 := Nodes{}
	for _, n := range ns {
		for _, t := range types {
			if n.n.t == t {
				ns2 = append(ns2, n)
				break
			}
		}
	}
	return ns2
}

type node struct {
	id    string
	attrs []*Attr
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
	for _, attr := range n.n.attrs {
		if attr.Name == key {
			return attr.Value
		}
	}
	return ""
}

func (n *Node) Attrs() []*Attr {
	return n.n.attrs
}

func (n *Node) Edges(edgeName string, edgeDir string) Edges {
	edges := Edges{}
	for _, e := range n.g.edges {
		if edgeDir != "" && edgeDir == "out" {
			if e.from != n.n.id {
				continue
			}
		}
		if edgeDir != "" && edgeDir == "in" {
			if e.to != n.n.id {
				continue
			}
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
func (n *Node) Out(edgeNames ...string) Edges {
	edges := Edges{}
	for _, e := range n.g.edges {
		if e.from != n.n.id {
			continue
		}
		if len(edgeNames) > 0 {
			if !stringIn(e.name, edgeNames) {
				continue
			}
		}
		edges = append(edges, &Edge{
			e: e,
			g: n.g,
		})
	}
	return edges
}

func (n *Node) In(edgeNames ...string) Edges {
	edges := Edges{}
	for _, e := range n.g.edges {
		if e.to != n.n.id {
			continue
		}
		if len(edgeNames) > 0 {
			if !stringIn(e.name, edgeNames) {
				continue
			}
		}
		edges = append(edges, &Edge{
			in: true,
			e:  e,
			g:  n.g,
		})
	}
	return edges
}
