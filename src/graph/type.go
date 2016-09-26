package graph

type Type struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Fields      Fields `json:"fields"`
}

func (t *Type) Field(name string) *Field {
	for _, f := range t.Fields {
		if f.Name == name {
			return f
		}
	}
	return nil
}
