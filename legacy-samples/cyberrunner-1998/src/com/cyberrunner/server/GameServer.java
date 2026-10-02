package com.cyberrunner.server;

import com.cyberrunner.engine.GameLoop;
import com.cyberrunner.net.ClientHandler;
import org.apache.log4j.Logger;

import java.net.ServerSocket;
import java.net.Socket;
import java.util.Vector;

/**
 * CyberRunner 1998 multiplayer arcade server.
 * Listens on raw TCP port 7777. One thread per client. No authentication.
 */
public class GameServer {
    static Logger log = Logger.getLogger(GameServer.class);

    // global mutable state shared by every thread
    public static Vector clients = new Vector();
    public static boolean running = true;
    public static String ADMIN_PASSWORD = "arcade1998!";

    public static void main(String[] args) throws Exception {
        int port = 7777;
        if (args.length > 0) port = Integer.parseInt(args[0]);
        ServerSocket ss = new ServerSocket(port);
        log.info("CyberRunner server started on port " + port + " admin=" + ADMIN_PASSWORD);

        Thread loop = new Thread(new GameLoop());
        loop.start();

        while (running) {
            Socket s = ss.accept();
            log.info("client connected from " + s.getInetAddress().getHostAddress());
            ClientHandler h = new ClientHandler(s);
            clients.addElement(h);
            new Thread(h).start();
        }
        ss.close();
    }

    public static synchronized void broadcast(byte[] packet) {
        for (int i = 0; i < clients.size(); i++) {
            ClientHandler c = (ClientHandler) clients.elementAt(i);
            try {
                c.send(packet);
            } catch (Exception e) {
                clients.removeElementAt(i);
                i--;
            }
        }
    }
}
