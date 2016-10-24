package main

import (
	"db"
	"encoding/json"
	"fmt"
	"hash/fnv"
	"sync"

	"github.com/gorilla/websocket"
)

func send(ws *websocket.Conn, msg *WireMsg) error {
	data, err := json.Marshal(msg)
	if err != nil {
		return err
	}
	// fmt.Println("SEND", string(data))
	if err := ws.WriteMessage(websocket.TextMessage, data); err != nil {
		return err
	}
	return nil
}

type Client struct {
	ws            *websocket.Conn
	subscriptions map[string]func()
	session       *Session
	sync.Mutex
}

func (c *Client) Send(msg *WireMsg) error {
	c.Lock()
	defer c.Unlock()
	return send(c.ws, msg)
}

func (c *Client) OnConflict(conflict *db.Conflict) {
	c.Send(&WireMsg{
		Type:  "error",
		Error: "Some of your unpublished changes were lost due to conflicts caused by another user",
	})
}

func (c *Client) OnMessage(msg *WireMsg) error {
	c.session.Lock()
	defer c.session.Unlock()
	switch msg.Type {
	case "query":
		result := c.session.conn.QueryWithParams(msg.Query, msg.Params)
		return c.Send(&WireMsg{
			Tag:  msg.Tag,
			Type: "data",
			Data: result,
		})
	case "exec":
		result := c.session.conn.ExecWithParams(msg.Query, msg.Params)
		return c.Send(&WireMsg{
			Tag:  msg.Tag,
			Type: "data",
			Data: result,
		})
	case "commit":
		err := c.session.conn.Commit()
		if err != nil {
			return fmt.Errorf("failed to commit: %s", err.Error())
		}
		return c.Send(&WireMsg{
			Tag:  msg.Tag,
			Type: "ok",
		})
	case "subscribe":
		execQuery := c.newQueryFunc(msg)
		c.subscriptions[msg.Subscription] = execQuery
		err := c.Send(&WireMsg{
			Tag:  msg.Tag,
			Type: "ok",
		})
		go execQuery()
		return err
	case "unsubscribe":
		delete(c.subscriptions, msg.Subscription)
		return c.Send(&WireMsg{
			Tag:  msg.Tag,
			Type: "ok",
		})
	default:
		return fmt.Errorf("unknown message type: %s", msg.Type)
	}
}

func (c *Client) hashResult(data interface{}) uint32 {
	b, _ := json.Marshal(data)
	return c.hashBytes(b)
}

func (c *Client) hashBytes(b []byte) uint32 {
	h := fnv.New32a()
	h.Write(b)
	return h.Sum32()
}

func (c *Client) newQueryFunc(msg *WireMsg) func() {
	return func() {
		fmt.Println("RUNNING QUERY", msg.Subscription)
		result := c.session.conn.QueryWithParams(msg.Query, msg.Params)
		dataHash := c.hashResult(result)
		if msg.dataHash == dataHash {
			fmt.Println(msg.Subscription, "UNCHANGED")
			return
		}
		msg.dataHash = dataHash
		err := c.Send(&WireMsg{
			Subscription: msg.Subscription,
			Type:         "data",
			Data:         result,
		})
		if err != nil {
			senderr := c.Send(&WireMsg{
				Subscription: msg.Subscription,
				Type:         "error",
				Error:        err.Error(),
			})
			if senderr != nil {
				fmt.Println("SENDERR", senderr)
			}
		}
	}
}

func (c *Client) SendError(err error, tag string) error {
	return c.Send(&WireMsg{
		Tag:   tag,
		Type:  "error",
		Error: err.Error(),
	})
}

func (c *Client) Accept() (err error) {
	defer func() {
		if err == nil {
			if r := recover(); r != nil {
				fmt.Println("Accept panic:", r)
				err = fmt.Errorf("recover: %s", r)
			}
		}
	}()
	_, data, err := c.ws.ReadMessage()
	if err != nil {
		return
	}
	var msg WireMsg
	// fmt.Println("RECV", data)
	err = json.Unmarshal([]byte(data), &msg)
	if err != nil {
		fmt.Println("Unmarshal err ->", err)
		c.SendError(err, "")
		return
	}
	err = c.OnMessage(&msg)
	if err != nil {
		fmt.Println("OnMessage err ->", err)
		c.SendError(err, msg.Tag)
		return
	}
	return
}

func (c *Client) AcceptLoop() error {
	for {
		if err := c.Accept(); err != nil {
			return err
		}
	}
}
