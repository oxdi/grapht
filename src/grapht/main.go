package main

import (
	"fmt"
	"os"

	"github.com/urfave/cli"
)

var (
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
	app.Flags = []cli.Flag{
		cli.IntFlag{
			Name:        "port, p",
			Value:       8282,
			Usage:       "port too run webserver on",
			Destination: &SERVER_PORT,
		},
		cli.StringFlag{
			Name:        "data-dir,d",
			Value:       "./data/",
			Usage:       "path to data dir",
			Destination: &DATA_DIR,
		},
	}
	app.Action = func(c *cli.Context) error {
		fmt.Println("serving...")
		StartServer()
		return nil
	}

	app.Run(os.Args)
}
