package com.cyberrunner.net;

import com.cyberrunner.engine.Player;
import com.cyberrunner.engine.World;

import java.io.ByteArrayOutputStream;
import java.io.DataOutputStream;
import java.io.IOException;

/**
 * Binary wire protocol (big endian). Undocumented since 1999.
 *  0x01 JOIN   [u8 op][u8 nameLen][bytes name]
 *  0x02 JUMP   [u8 op]
 *  0x03 SCORE  [u8 op][i32 score][u8 nameLen][bytes name]   <- client-reported score!
 *  0x10 STATE  [u8 op][i64 tick][f32 speed][u8 n]{[i32 id][f32 y][i32 score][u8 state]}*n
 *  0x7F ADMIN  [u8 op][u8 pwLen][bytes pw][u8 cmd]
 */
public class Protocol {
    public static final byte JOIN = 0x01;
    public static final byte JUMP = 0x02;
    public static final byte SCORE = 0x03;
    public static final byte STATE = 0x10;
    public static final byte ADMIN = 0x7F;

    public static byte[] encodeState(World w, long tick) {
        try {
            ByteArrayOutputStream bos = new ByteArrayOutputStream();
            DataOutputStream out = new DataOutputStream(bos);
            out.writeByte(STATE);
            out.writeLong(tick);
            out.writeFloat((float) w.speed);
            out.writeByte(w.players.size());
            for (int i = 0; i < w.players.size(); i++) {
                Player p = (Player) w.players.elementAt(i);
                out.writeInt(p.id);
                out.writeFloat((float) p.y);
                out.writeInt(p.score);
                out.writeByte(p.state);
            }
            return bos.toByteArray();
        } catch (IOException e) {
            return new byte[0];
        }
    }
}
