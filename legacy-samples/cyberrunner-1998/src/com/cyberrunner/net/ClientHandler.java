package com.cyberrunner.net;

import com.cyberrunner.engine.GameLoop;
import com.cyberrunner.engine.Player;
import com.cyberrunner.score.HighScoreStore;
import com.cyberrunner.server.GameServer;
import org.apache.log4j.Logger;

import java.io.DataInputStream;
import java.io.DataOutputStream;
import java.net.Socket;

public class ClientHandler implements Runnable {
    static Logger log = Logger.getLogger(ClientHandler.class);
    static int nextId = 1;

    Socket socket;
    DataInputStream in;
    DataOutputStream out;
    Player player;

    public ClientHandler(Socket s) throws Exception {
        socket = s;
        in = new DataInputStream(s.getInputStream());
        out = new DataOutputStream(s.getOutputStream());
    }

    public synchronized void send(byte[] packet) throws Exception {
        out.write(packet);   // blocking write; a slow client stalls the broadcast loop
        out.flush();
    }

    public void run() {
        try {
            while (true) {
                int op = in.readByte();
                if (op == Protocol.JOIN) {
                    byte[] name = new byte[in.readUnsignedByte()];
                    in.readFully(name);
                    player = new Player();
                    player.id = nextId++;
                    player.name = new String(name);
                    synchronized (GameLoop.world) {
                        GameLoop.world.players.addElement(player);
                    }
                    log.info("JOIN " + player.name + " from " + socket.getInetAddress());
                } else if (op == Protocol.JUMP) {
                    if (player != null) player.jump();
                } else if (op == Protocol.SCORE) {
                    int score = in.readInt();
                    byte[] name = new byte[in.readUnsignedByte()];
                    in.readFully(name);
                    // trusts whatever score the client says
                    HighScoreStore.submit(new String(name), score);
                } else if (op == Protocol.ADMIN) {
                    byte[] pw = new byte[in.readUnsignedByte()];
                    in.readFully(pw);
                    int cmd = in.readByte();
                    if (new String(pw).equals(GameServer.ADMIN_PASSWORD) && cmd == 1) {
                        GameServer.running = false;
                    }
                }
            }
        } catch (Exception e) {
            log.error("client error " + e);
        }
    }
}
