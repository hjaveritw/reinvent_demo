package com.cyberrunner.engine;

import java.util.Random;
import java.util.Vector;

public class World {
    public Vector players = new Vector();
    public Vector obstacles = new Vector(); // int[]{x, width, height}
    public double speed = GameLoop.BASE_SPEED;
    Random rnd = new Random();

    public static final int PLAYER_X = 80;
    public static final int PLAYER_W = 24;
    public static final int PLAYER_H = 32;

    public void spawnObstacle() {
        int w = 16 + rnd.nextInt(24);
        int h = 20 + rnd.nextInt(30);
        obstacles.addElement(new int[]{800, w, h});
    }

    public void advanceObstacles() {
        for (int i = obstacles.size() - 1; i >= 0; i--) {
            int[] o = (int[]) obstacles.elementAt(i);
            o[0] -= (int) speed;
            if (o[0] + o[1] < 0) obstacles.removeElementAt(i);
        }
    }

    public boolean collides(Player p) {
        for (int i = 0; i < obstacles.size(); i++) {
            int[] o = (int[]) obstacles.elementAt(i);
            boolean xHit = PLAYER_X + PLAYER_W > o[0] && PLAYER_X < o[0] + o[1];
            boolean yHit = p.y > GameLoop.GROUND_Y - o[2];
            if (xHit && yHit) return true;
        }
        return false;
    }
}
