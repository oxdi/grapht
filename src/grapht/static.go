package main

import (
	"bytes"
	"io"
	"net/http"
	"strconv"
	"strings"

	"github.com/labstack/echo"
)

func static(c echo.Context) error {
	res := c.Response()
	h := res.Header()
	// check for asset at path
	path := strings.Replace(c.Request().URL().Path(), "/", "", 1)
	data, err := Asset(path)
	if data != nil {
		h.Set(echo.HeaderContentLength, strconv.Itoa(len(data)))
		res.WriteHeader(http.StatusOK)
		r := bytes.NewReader(data)
		w := res.Writer()
		_, err = io.Copy(w, r)
		return err
	}
	// default index handler...
	data, err = Asset("index.html.gz")
	if err != nil {
		return err
	}
	h.Set(echo.HeaderContentType, echo.MIMETextHTMLCharsetUTF8)
	h.Set(echo.HeaderContentEncoding, "gzip")
	h.Set(echo.HeaderContentLength, strconv.Itoa(len(data)))
	res.WriteHeader(http.StatusOK)
	r := bytes.NewReader(data)
	w := res.Writer()
	_, err = io.Copy(w, r)
	return err
}
