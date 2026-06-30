# Next Leg Design Specification

## Target Device
Pebble Time 2 (Emery), 200x228 display.

## Version 1.0 Design

### Theme
- Dark mode
- Black background
- White primary text
- Blue divider lines and labels
- Green = On Time
- Yellow = Delayed
- Red = Cancelled

## Screen Layout

### Top Row
- Local time, large, left aligned
- UTC hour, right side
- Optional Bluetooth icon
- Optional Battery icon

### Flight Section
- Large flight number
- Route underneath
- No airline logo in public v1.0

### Bottom Row
Three columns:

- Gate
- DEP
- Status

Example:

GATE | DEP | STAT  
A21 | 10:15 | ON TIME

## Version 1.0 Scope
- Static watchface first
- No FlightAware yet
- No AI schedule import yet
- No airline logos in public release

## Version 1.1 Roadmap
- FlightAware integration
- Show/hide Bluetooth
- Show/hide Battery
- Gate/status vibration alerts
- Optional user-supplied airline logos