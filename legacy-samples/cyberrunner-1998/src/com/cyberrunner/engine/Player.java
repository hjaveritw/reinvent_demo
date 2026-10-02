package com.cyberrunner.engine;

public class Player {
    public static final int RUNNING = 0;
    public static final int JUMPING = 1;
    public static final int DEAD = 2;

    public int id;
    public String name;
    public double y = GameLoop.GROUND_Y;
    public double vy = 0;
    public double distance = 0;
    public int score = 0;
    public int state = RUNNING;

    public void jump() {
        // only allowed while on the ground (no double jump)
        if (state == RUNNING && y >= GameLoop.GROUND_Y) {
            vy = GameLoop.JUMP_VELOCITY;
            state = JUMPING;
        }
    }
}
