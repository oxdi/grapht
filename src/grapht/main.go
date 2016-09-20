package main

import (
	"fmt"
	"os"

	"github.com/urfave/cli"
)

const (
	AUTH_SECRET = "OuwfjE6rJcMOZjOpsW15QlXWLxLzYGjxTgkVK"
	SERVER_PORT = 8282
	DATA_DIR    = "./data/"
)

func Open() {
	// open mutation log
	// for each mutation apply it
}

func main() {
	app := cli.NewApp()
	app.Name = "structa"
	app.Usage = "content structure server"
	app.Action = func(c *cli.Context) error {
		fmt.Println("serving...")
		StartServer()
		return nil
	}

	app.Run(os.Args)
}
