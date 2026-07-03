#include <pebble.h>

/*
  Next Leg v0.1 Alpha 5
  Static Pebble Time 2 watchface
  Clean top bar: Local Time + UTC only
*/

static Window *s_main_window;
static Layer *s_canvas_layer;

static TextLayer *s_time_layer;
static TextLayer *s_utc_layer;
static TextLayer *s_flight_layer;
static TextLayer *s_route_layer;

static TextLayer *s_gate_label_layer;
static TextLayer *s_gate_value_layer;
static TextLayer *s_dep_label_layer;
static TextLayer *s_dep_value_layer;
static TextLayer *s_status_label_layer;
static TextLayer *s_status_value_layer;

// Static demo flight data
static const char *FLIGHT_NUMBER = "AA1234";
static const char *ROUTE = "DFW > LAX";
static const char *GATE = "A21";
static const char *DEP = "10:15";
static const char *STATUS = "ON TIME";

// Colours
#define COLOR_BG    GColorBlack
#define COLOR_TEXT  GColorWhite
#define COLOR_BLUE  GColorBlueMoon
#define COLOR_GRAY  GColorLightGray
#define COLOR_GREEN GColorGreen

static TextLayer *make_text_layer(
  GRect frame,
  GFont font,
  GColor color,
  GTextAlignment alignment
) {
  TextLayer *layer = text_layer_create(frame);

  text_layer_set_background_color(layer, GColorClear);
  text_layer_set_text_color(layer, color);
  text_layer_set_font(layer, font);
  text_layer_set_text_alignment(layer, alignment);

  return layer;
}

// Draw the blue dividers only
static void canvas_update_proc(Layer *layer, GContext *ctx) {
  graphics_context_set_stroke_color(ctx, COLOR_BLUE);

  // Main horizontal dividers
  graphics_context_set_stroke_width(ctx, 2);
  graphics_draw_line(ctx, GPoint(8, 52), GPoint(192, 52));
  graphics_draw_line(ctx, GPoint(8, 140), GPoint(192, 140));

  // Bottom column dividers
  graphics_context_set_stroke_width(ctx, 1);
  graphics_draw_line(ctx, GPoint(70, 150), GPoint(70, 220));
  graphics_draw_line(ctx, GPoint(132, 150), GPoint(132, 220));
}

static void update_time() {
  time_t now = time(NULL);

  struct tm *local_time = localtime(&now);
  struct tm *utc_time = gmtime(&now);

  static char time_buffer[8];
  static char utc_buffer[8];

  strftime(
    time_buffer,
    sizeof(time_buffer),
    clock_is_24h_style() ? "%H:%M" : "%I:%M",
    local_time
  );

  strftime(
    utc_buffer,
    sizeof(utc_buffer),
    "UTC%H",
    utc_time
  );

  text_layer_set_text(s_time_layer, time_buffer);
  text_layer_set_text(s_utc_layer, utc_buffer);
}

static void tick_handler(struct tm *tick_time, TimeUnits units_changed) {
  update_time();
}

static void main_window_load(Window *window) {
  Layer *root = window_get_root_layer(window);

  // Background divider layer
  s_canvas_layer = layer_create(GRect(0, 0, 200, 228));
  layer_set_update_proc(s_canvas_layer, canvas_update_proc);
  layer_add_child(root, s_canvas_layer);

  // Top row: local time
  s_time_layer = make_text_layer(
    GRect(8, 6, 120, 46),
    fonts_get_system_font(FONT_KEY_BITHAM_42_BOLD),
    COLOR_TEXT,
    GTextAlignmentLeft
  );

  // Top row: UTC
  s_utc_layer = make_text_layer(
    GRect(140, 16, 52, 28),
    fonts_get_system_font(FONT_KEY_GOTHIC_24_BOLD),
    COLOR_BLUE,
    GTextAlignmentCenter
  );

  // Flight number - moved up to center better in middle section
  s_flight_layer = make_text_layer(
    GRect(0, 62, 200, 50),
    fonts_get_system_font(FONT_KEY_BITHAM_42_BOLD),
    COLOR_TEXT,
    GTextAlignmentCenter
  );
  text_layer_set_text(s_flight_layer, FLIGHT_NUMBER);

  // Route - moved up to sit under flight number within middle section
  s_route_layer = make_text_layer(
    GRect(0, 102, 200, 28),
    fonts_get_system_font(FONT_KEY_GOTHIC_28_BOLD),
    COLOR_GRAY,
    GTextAlignmentCenter
  );
  text_layer_set_text(s_route_layer, ROUTE);

  // Bottom labels
  s_gate_label_layer = make_text_layer(
    GRect(8, 150, 60, 26),
    fonts_get_system_font(FONT_KEY_GOTHIC_24_BOLD),
    COLOR_BLUE,
    GTextAlignmentCenter
  );
  text_layer_set_text(s_gate_label_layer, "GATE");

  s_dep_label_layer = make_text_layer(
    GRect(72, 150, 58, 26),
    fonts_get_system_font(FONT_KEY_GOTHIC_24_BOLD),
    COLOR_BLUE,
    GTextAlignmentCenter
  );
  text_layer_set_text(s_dep_label_layer, "DEP");

  s_status_label_layer = make_text_layer(
    GRect(134, 150, 58, 26),
    fonts_get_system_font(FONT_KEY_GOTHIC_24_BOLD),
    COLOR_BLUE,
    GTextAlignmentCenter
  );
  text_layer_set_text(s_status_label_layer, "STAT");

  // Bottom values
  s_gate_value_layer = make_text_layer(
    GRect(8, 184, 60, 36),
    fonts_get_system_font(FONT_KEY_GOTHIC_28_BOLD),
    COLOR_TEXT,
    GTextAlignmentCenter
  );
  text_layer_set_text(s_gate_value_layer, GATE);

  s_dep_value_layer = make_text_layer(
    GRect(72, 184, 58, 36),
    fonts_get_system_font(FONT_KEY_GOTHIC_28_BOLD),
    COLOR_TEXT,
    GTextAlignmentCenter
  );
  text_layer_set_text(s_dep_value_layer, DEP);

  // Smaller font so ON TIME fits fully
  s_status_value_layer = make_text_layer(
    GRect(134, 188, 58, 24),
    fonts_get_system_font(FONT_KEY_GOTHIC_18_BOLD),
    COLOR_GREEN,
    GTextAlignmentCenter
  );
  text_layer_set_text(s_status_value_layer, STATUS);

  // Add layers
  layer_add_child(root, text_layer_get_layer(s_time_layer));
  layer_add_child(root, text_layer_get_layer(s_utc_layer));

  layer_add_child(root, text_layer_get_layer(s_flight_layer));
  layer_add_child(root, text_layer_get_layer(s_route_layer));

  layer_add_child(root, text_layer_get_layer(s_gate_label_layer));
  layer_add_child(root, text_layer_get_layer(s_gate_value_layer));

  layer_add_child(root, text_layer_get_layer(s_dep_label_layer));
  layer_add_child(root, text_layer_get_layer(s_dep_value_layer));

  layer_add_child(root, text_layer_get_layer(s_status_label_layer));
  layer_add_child(root, text_layer_get_layer(s_status_value_layer));

  update_time();
}

static void main_window_unload(Window *window) {
  text_layer_destroy(s_time_layer);
  text_layer_destroy(s_utc_layer);

  text_layer_destroy(s_flight_layer);
  text_layer_destroy(s_route_layer);

  text_layer_destroy(s_gate_label_layer);
  text_layer_destroy(s_gate_value_layer);

  text_layer_destroy(s_dep_label_layer);
  text_layer_destroy(s_dep_value_layer);

  text_layer_destroy(s_status_label_layer);
  text_layer_destroy(s_status_value_layer);

  layer_destroy(s_canvas_layer);
}

static void init() {
  s_main_window = window_create();
  window_set_background_color(s_main_window, COLOR_BG);

  window_set_window_handlers(s_main_window, (WindowHandlers) {
    .load = main_window_load,
    .unload = main_window_unload
  });

  window_stack_push(s_main_window, true);

  tick_timer_service_subscribe(MINUTE_UNIT, tick_handler);
}

static void deinit() {
  tick_timer_service_unsubscribe();
  window_destroy(s_main_window);
}

int main(void) {
  init();
  app_event_loop();
  deinit();
}
