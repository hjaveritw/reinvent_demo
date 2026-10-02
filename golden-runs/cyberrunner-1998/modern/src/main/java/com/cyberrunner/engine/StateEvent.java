package com.cyberrunner.engine;

import java.util.List;

/** Replaces legacy binary STATE (0x10) packet with a JSON event broadcast over STOMP. */
public record StateEvent(long tick, double speed, List<PlayerSnapshot> players) {
}
