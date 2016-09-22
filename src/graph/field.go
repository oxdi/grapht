package graph

type Field struct {
	Type        string `json:"type"`
	Name        string `json:"name"`
	Description string `json:"description"`

	// Generic opts
	Required bool   `json:"required"`
	Hint     string `json:"hint"`

	// Text opts
	TextMarkup    string `json:"textMarkup"`
	TextLines     int    `json:"textLines"`
	TextLineLimit int    `json:"textLineLimit"`
	TextCharLimit int    `json:"textCharLimit"`

	// Edge opts
	EdgeToType string `json:"edgeToType"`
	EdgeName   string `json:"edgeName"`
}

type Fields []*Field
