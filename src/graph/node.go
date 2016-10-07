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
	Name  string `json:"name"`
	Value string `json:"value"`
	Enc   string `json:"enc"`
}

type NodeConfig struct {
	ID    string  `json:"id"`
	Type  *Type   `json:"type"`
	Attrs []*Attr `json:"attrs"`
	Merge bool    `json:"merge"`
}

type Nodes []*Node

func (ns Nodes) First() *Node {
	if len(ns) == 0 {
		return nil
	}
	return ns[0]
}

func (ns Nodes) FilterType(types ...*Type) Nodes {
	if len(types) == 0 {
		return ns
	}
	if len(ns) == 0 {
		return ns
	}
	ns2 := Nodes{}
	for _, n := range ns {
		for _, t := range types {
			if n.Type() == t {
				ns2 = append(ns2, n)
				break
			}
		}
	}
	return ns2
}

func (ns Nodes) Len() int      { return len(ns) }
func (ns Nodes) Swap(i, j int) { ns[i], ns[j] = ns[j], ns[i] }
func (ns Nodes) Less(i, j int) bool {
	return ns[i].ID() < ns[j].ID()
}

type node struct {
	id     string
	attrs  []*Attr
	typeID string
}

type Node struct {
	g *Graph
	n *node
}

func (n *Node) ID() string {
	return n.n.id
}

func (n *Node) Type() *Type {
	return n.g.TypeByID(n.n.typeID)
}

func (n *Node) Attr(key string) *Attr {
	if n.n.attrs == nil {
		return nil
	}
	for _, attr := range n.n.attrs {
		if attr.Name == key {
			return attr
		}
	}
	return nil
}

func (n *Node) Attrs() []*Attr {
	return n.n.attrs
}

func (n *Node) Edges(edgeNames []string, edgeDir string) Edges {
	edges := Edges{}
	for _, e := range n.g.edges {
		if edgeDir == "Out" {
			if e.from != n.n.id {
				continue
			}
		} else if edgeDir == "In" {
			if e.to != n.n.id {
				continue
			}
		} else if e.to != n.n.id && e.from != n.n.id {
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
