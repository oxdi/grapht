package db

import (
	"bytes"
	"encoding/base64"
	"fmt"
	"image"
	"io"
	"strings"

	"github.com/disintegration/imaging"
)

type ResizeConfig struct {
	Width    int
	Height   int
	Resample string
	Method   string
	Anchor   int
}

func decodeImageDataURI(data string) (image.Image, error) {
	r, err := NewImageDataReader(data)
	if err != nil {
		return nil, err
	}
	return imaging.Decode(r)
}

func NewImageDataReader(data string) (io.Reader, error) {
	if data == "" {
		return nil, fmt.Errorf("invalid data uri: blank")
	}
	dataParts := strings.Split(data, ",")
	if len(dataParts) < 2 {
		return nil, fmt.Errorf("invalid data uri: encoding not found")
	}
	b64data := dataParts[1]
	if b64data == "" {
		return nil, fmt.Errorf("invalid data uri: blank base64 data")
	}
	r := base64.NewDecoder(base64.StdEncoding, strings.NewReader(b64data))
	return r, nil
}

func encodeImageDataURI(img image.Image) (string, error) {
	var buf bytes.Buffer
	w := base64.NewEncoder(base64.StdEncoding, &buf)
	imaging.Encode(w, img, imaging.JPEG)
	return fmt.Sprintf("%s;base64,%s", "image/jpeg", buf.String()), nil
}

func resizeImage(img image.Image, cfg *ResizeConfig) image.Image {
	return imaging.Fill(img, cfg.Width, cfg.Height, imaging.Center, imaging.Lanczos)
}
