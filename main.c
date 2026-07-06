#include <pebble.h>

/*
  Next Leg v0.5.7
  - Restore the large top-row day/Zulu readout
  - Shift local day 4 px right to clear the local clock
  - Live FlightAware refresh on shake
  - Report mode between flights
  - 2-hour final-leg hotel hold with next report time
*/

static Window *s_main_window;
static Layer *s_canvas_layer;

static TextLayer *s_time_layer;
static TextLayer *s_date_layer;
static TextLayer *s_zulu_layer;
static TextLayer *s_flight_layer;
static TextLayer *s_route_layer;

static TextLayer *s_gate_label_layer;
static TextLayer *s_gate_value_layer;
static TextLayer *s_dep_label_layer;
static TextLayer *s_dep_value_layer;
static TextLayer *s_status_label_layer;
static TextLayer *s_status_value_layer;

static char s_flight_number[12] = "AA1234";
static char s_route[16] = "DFW > LAX";
static char s_gate[8] = "--";
static char s_dep[8] = "--";
static char s_status[16] = "--";

#define COLOR_BG     GColorBlack
#define COLOR_TEXT   GColorWhite
#define COLOR_BLUE   GColorBlueMoon
#define COLOR_GRAY   GColorLightGray
#define COLOR_GREEN  GColorGreen
#define COLOR_YELLOW GColorChromeYellow
#define COLOR_FOLLY  GColorFolly

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

static void update_status_colour(void) {
  if (strcmp(s_status, "ON TIME") == 0) {
    text_layer_set_text_color(s_status_value_layer, COLOR_GREEN);
  } else if (strcmp(s_status, "DELAY") == 0) {
    text_layer_set_text_color(s_status_value_layer, COLOR_YELLOW);
  } else if (strcmp(s_status, "CNX") == 0) {
    text_layer_set_text_color(s_status_value_layer, COLOR_FOLLY);
  } else if (strcmp(s_status, "ARR") == 0 ||
             strcmp(s_status, "SYNC") == 0) {
    text_layer_set_text_color(s_status_value_layer, COLOR_BLUE);
  } else if (strcmp(s_status, "ERR") == 0 ||
             strcmp(s_status, "KEY") == 0 ||
             strcmp(s_status, "NO PHONE") == 0) {
    text_layer_set_text_color(s_status_value_layer, COLOR_FOLLY);
  } else if (strcmp(s_status, "--") == 0) {
    text_layer_set_text_color(s_status_value_layer, COLOR_TEXT);
  } else {
    text_layer_set_text_color(s_status_value_layer, COLOR_GRAY);
  }
}

static void update_status_display(void) {
  if (strcmp(s_status, "--") == 0 ||
      strcmp(s_status, "CNX") == 0) {
    text_layer_set_font(
      s_status_value_layer,
      fonts_get_system_font(FONT_KEY_GOTHIC_28_BOLD)
    );

    layer_set_frame(
      text_layer_get_layer(s_status_value_layer),
      GRect(134, 184, 58, 36)
    );
  } else {
    text_layer_set_font(
      s_status_value_layer,
      fonts_get_system_font(FONT_KEY_GOTHIC_18_BOLD)
    );

    layer_set_frame(
      text_layer_get_layer(s_status_value_layer),
      GRect(134, 188, 58, 24)
    );
  }

  text_layer_set_text(s_status_value_layer, s_status);
  update_status_colour();
}

static void update_route_display(void) {
  if (strncmp(s_route, "REPORT ", 7) == 0 ||
      strcmp(s_route, "NO SCHEDULE") == 0) {
    text_layer_set_font(
      s_route_layer,
      fonts_get_system_font(FONT_KEY_GOTHIC_18_BOLD)
    );

    layer_set_frame(
      text_layer_get_layer(s_route_layer),
      GRect(0, 106, 200, 24)
    );
  } else {
    text_layer_set_font(
      s_route_layer,
      fonts_get_system_font(FONT_KEY_GOTHIC_28_BOLD)
    );

    layer_set_frame(
      text_layer_get_layer(s_route_layer),
      GRect(0, 102, 200, 28)
    );
  }

  text_layer_set_text_color(s_route_layer, COLOR_GRAY);
  text_layer_set_text(s_route_layer, s_route);
}

static void copy_or_dashes(
  char *destination,
  size_t size,
  const char *source
) {
  if (source && source[0] != '\0') {
    snprintf(destination, size, "%s", source);
  } else {
    snprintf(destination, size, "--");
  }
}

static void clear_flight_info(void) {
  snprintf(s_gate, sizeof(s_gate), "--");
  snprintf(s_dep, sizeof(s_dep), "--");
  snprintf(s_status, sizeof(s_status), "--");

  text_layer_set_text(s_gate_value_layer, s_gate);
  text_layer_set_text(s_dep_value_layer, s_dep);
  update_status_display();
}

static void canvas_update_proc(Layer *layer, GContext *ctx) {
  graphics_context_set_stroke_color(ctx, COLOR_BLUE);

  graphics_context_set_stroke_width(ctx, 2);
  graphics_draw_line(ctx, GPoint(8, 52), GPoint(192, 52));
  graphics_draw_line(ctx, GPoint(8, 140), GPoint(192, 140));

  graphics_context_set_stroke_width(ctx, 1);
  graphics_draw_line(ctx, GPoint(70, 150), GPoint(70, 220));
  graphics_draw_line(ctx, GPoint(132, 150), GPoint(132, 220));
}

static void update_time(void) {
  time_t now = time(NULL);
  struct tm *local_time = localtime(&now);
  struct tm *utc_time = gmtime(&now);

  static char time_buffer[8];
  static char date_buffer[4];
  static char zulu_buffer[5];

  strftime(time_buffer, sizeof(time_buffer), "%H:%M", local_time);
  strftime(date_buffer, sizeof(date_buffer), "%d", local_time);
  strftime(zulu_buffer, sizeof(zulu_buffer), "%HZ", utc_time);

  text_layer_set_text(s_time_layer, time_buffer);
  text_layer_set_text(s_date_layer, date_buffer);
  text_layer_set_text(s_zulu_layer, zulu_buffer);
}

static void tick_handler(
  struct tm *tick_time,
  TimeUnits units_changed
) {
  update_time();
}

static void inbox_received_handler(
  DictionaryIterator *iterator,
  void *context
) {
  Tuple *flight_tuple =
    dict_find(iterator, MESSAGE_KEY_FlightNumber);

  Tuple *route_tuple =
    dict_find(iterator, MESSAGE_KEY_Route);

  Tuple *gate_tuple =
    dict_find(iterator, MESSAGE_KEY_Gate);

  Tuple *dep_tuple =
    dict_find(iterator, MESSAGE_KEY_DepartureTime);

  Tuple *status_tuple =
    dict_find(iterator, MESSAGE_KEY_FlightStatus);

  if (flight_tuple || route_tuple) {
    clear_flight_info();
  }

  if (flight_tuple) {
    copy_or_dashes(
      s_flight_number,
      sizeof(s_flight_number),
      flight_tuple->value->cstring
    );

    text_layer_set_text(s_flight_layer, s_flight_number);
  }

  if (route_tuple) {
    copy_or_dashes(
      s_route,
      sizeof(s_route),
      route_tuple->value->cstring
    );

    update_route_display();
  }

  if (gate_tuple) {
    copy_or_dashes(
      s_gate,
      sizeof(s_gate),
      gate_tuple->value->cstring
    );

    text_layer_set_text(s_gate_value_layer, s_gate);
  }

  if (dep_tuple) {
    copy_or_dashes(
      s_dep,
      sizeof(s_dep),
      dep_tuple->value->cstring
    );

    text_layer_set_text(s_dep_value_layer, s_dep);
  }

  if (status_tuple) {
    copy_or_dashes(
      s_status,
      sizeof(s_status),
      status_tuple->value->cstring
    );

    update_status_display();
  }
}

static void tap_handler(
  AccelAxisType axis,
  int32_t direction
) {
  snprintf(s_status, sizeof(s_status), "SYNC");
  update_status_display();

  DictionaryIterator *outbox_iterator = NULL;

  AppMessageResult result =
    app_message_outbox_begin(&outbox_iterator);

  if (result == APP_MSG_OK) {
    dict_write_int8(
      outbox_iterator,
      MESSAGE_KEY_RefreshRequest,
      1
    );

    dict_write_end(outbox_iterator);
    app_message_outbox_send();
  } else {
    snprintf(s_status, sizeof(s_status), "NO PHONE");
    update_status_display();
  }
}

static void main_window_load(Window *window) {
  Layer *root = window_get_root_layer(window);

  s_canvas_layer = layer_create(GRect(0, 0, 200, 228));
  layer_set_update_proc(s_canvas_layer, canvas_update_proc);
  layer_add_child(root, s_canvas_layer);

  s_time_layer = make_text_layer(
    GRect(0, 6, 134, 46),
    fonts_get_system_font(FONT_KEY_BITHAM_42_BOLD),
    COLOR_TEXT,
    GTextAlignmentLeft
  );
  text_layer_set_overflow_mode(
    s_time_layer,
    GTextOverflowModeFill
  );

  // Keep the original large day/Zulu size. Move only the local day
  // 4 px right toward the Zulu readout so 09:04 has breathing room.
  s_date_layer = make_text_layer(
    GRect(122, 22, 28, 28),
    fonts_get_system_font(FONT_KEY_GOTHIC_24_BOLD),
    COLOR_FOLLY,
    GTextAlignmentCenter
  );

  s_zulu_layer = make_text_layer(
    GRect(148, 22, 44, 28),
    fonts_get_system_font(FONT_KEY_GOTHIC_24_BOLD),
    COLOR_FOLLY,
    GTextAlignmentCenter
  );

  s_flight_layer = make_text_layer(
    GRect(0, 62, 200, 50),
    fonts_get_system_font(FONT_KEY_BITHAM_42_BOLD),
    COLOR_TEXT,
    GTextAlignmentCenter
  );
  text_layer_set_text(s_flight_layer, s_flight_number);

  s_route_layer = make_text_layer(
    GRect(0, 102, 200, 28),
    fonts_get_system_font(FONT_KEY_GOTHIC_28_BOLD),
    COLOR_GRAY,
    GTextAlignmentCenter
  );
  update_route_display();

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

  s_gate_value_layer = make_text_layer(
    GRect(8, 184, 60, 36),
    fonts_get_system_font(FONT_KEY_GOTHIC_28_BOLD),
    COLOR_TEXT,
    GTextAlignmentCenter
  );
  text_layer_set_text(s_gate_value_layer, s_gate);

  s_dep_value_layer = make_text_layer(
    GRect(72, 184, 58, 36),
    fonts_get_system_font(FONT_KEY_GOTHIC_28_BOLD),
    COLOR_TEXT,
    GTextAlignmentCenter
  );
  text_layer_set_text(s_dep_value_layer, s_dep);

  s_status_value_layer = make_text_layer(
    GRect(134, 184, 58, 36),
    fonts_get_system_font(FONT_KEY_GOTHIC_28_BOLD),
    COLOR_TEXT,
    GTextAlignmentCenter
  );
  update_status_display();

  layer_add_child(root, text_layer_get_layer(s_time_layer));
  layer_add_child(root, text_layer_get_layer(s_date_layer));
  layer_add_child(root, text_layer_get_layer(s_zulu_layer));
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
  text_layer_destroy(s_date_layer);
  text_layer_destroy(s_zulu_layer);
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

static void init(void) {
  app_message_register_inbox_received(
    inbox_received_handler
  );

  app_message_open(256, 256);

  accel_tap_service_subscribe(tap_handler);

  s_main_window = window_create();
  window_set_background_color(s_main_window, COLOR_BG);

  window_set_window_handlers(
    s_main_window,
    (WindowHandlers) {
      .load = main_window_load,
      .unload = main_window_unload
    }
  );

  window_stack_push(s_main_window, true);

  tick_timer_service_subscribe(
    MINUTE_UNIT,
    tick_handler
  );
}

static void deinit(void) {
  accel_tap_service_unsubscribe();
  tick_timer_service_unsubscribe();
  window_destroy(s_main_window);
}

int main(void) {
  init();
  app_event_loop();
  deinit();
}
