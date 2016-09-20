package main

import (
	"encoding/json"
	"fmt"

	"golang.org/x/net/websocket"
)

func send(ws *websocket.Conn, msg *WireMsg) error {
	data, err := json.Marshal(msg)
	if err != nil {
		return err
	}
	fmt.Println("SEND", string(data))
	if err := websocket.Message.Send(ws, string(data)); err != nil {
		return err
	}
	return nil

}

type Client struct {
	ws            *websocket.Conn
	subscriptions map[string]func()
	session       *Session
}

func (c *Client) Send(msg *WireMsg) error {
	return send(c.ws, msg)
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
		delete(c.subscriptions, msg.Tag)
		return c.Send(&WireMsg{
			Tag:  msg.Tag,
			Type: "ok",
		})
	default:
		return fmt.Errorf("unknown message type: %s", msg.Type)
	}
}

func (c *Client) newQueryFunc(msg *WireMsg) func() {
	return func() {
		fmt.Println("RUNNING QUERY")
		result := c.session.conn.QueryWithParams(msg.Query, msg.Params)
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

func (c *Client) Accept() error {
	var data string
	err := websocket.Message.Receive(c.ws, &data)
	if err != nil {
		return err
	}
	var msg WireMsg
	fmt.Println("RECV", data)
	err = json.Unmarshal([]byte(data), &msg)
	if err != nil {
		fmt.Println("Unmarshal err ->", err)
		c.SendError(err, "")
		return nil
	}
	err = c.OnMessage(&msg)
	if err != nil {
		fmt.Println("OnMessage err ->", err)
		c.SendError(err, msg.Tag)
		return nil
	}
	return nil
}

func (c *Client) AcceptLoop() error {
	for {
		if err := c.Accept(); err != nil {
			return err
		}
	}
}
