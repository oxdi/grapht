package graph

type Field struct {
	Type        string `json:"type"`
	Name        string `json:"name"`
	Description string `json:"description"`

	// Generic opts
	FriendlyName string `json:"friendlyName"`
	Required     bool   `json:"required"`
	Hint         string `json:"hint"`
	Unit         string `json:"unit"`

	// Text opts
	TextMarkup    string `json:"textMarkup"`
	TextLines     int    `json:"textLines"`
	TextLineLimit int    `json:"textLineLimit"`
	TextCharLimit int    `json:"textCharLimit"`

	// Edge opts
	EdgeToTypeID string `json:"edgeToTypeID"`
	EdgeName     string `json:"edgeName"`
}

type Fields []*Field
