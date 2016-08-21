package graph

type Field struct {
	Type   string       `json:"type"`
	Name        string          `json:"name"`
	Description string          `json:"description"`
	Required    bool            `json:"required"`
	ToType      *Type `json:"toType"` // used by edge types
}

type Fields []*Field

