
#include <Adafruit_Sensor.h>
#include <DHT.h>
#include <DHT_U.h>
#include <SPI.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

//Define for SSD1306
#define SCREEN_WIDTH 128 // OLED display width, in pixels
#define SCREEN_HEIGHT 64 // OLED display height, in pixels

// Declaration for an SSD1306 display connected to I2C (SDA, SCL pins)
#define OLED_RESET     4 // Reset pin # (or -1 if sharing Arduino reset pin)
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

//define for DHT22
#define DHTPIN 2     // Digital pin connected to the DHT sensor 
#define DHTTYPE    DHT22     // DHT 22 (AM2302)


DHT_Unified dht(DHTPIN, DHTTYPE);


uint32_t delayMS;

int TempAvg;
int TempHigh;
int TempLow;
int HumAvg;
int HumHigh;
int HumLow;

void setup(){
  Serial.begin(115200);

  // SSD1306_SWITCHCAPVCC = generate display voltage from 3.3V internally
  if(!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) { // Address 0x3C for 128x32
    Serial.println(F("SSD1306 allocation failed"));
    for(;;); // Don\"t proceed, loop forever
  }


  display.clearDisplay();
  display.setTextSize(1);      // 
  display.setTextColor(WHITE); // Draw white text
  display.setCursor(0, 0);     // Start at top-left corner
  display.cp437(true);         // Use full 256 char \"Code Page 437\" font

  display.clearDisplay(); 
  display.setCursor(5,15);
  display.println("Temp Humidity Sensor");
  display.println();
  display.println("(C) 2019 TSODev");
  display.display();
  delay(2000);
  display.clearDisplay();
  display.setTextSize(2);      // 


    dht.begin();
  sensor_t sensor;

  Serial.write(128);              // START sensor
  Serial.print("{\"sensor\": ");
  dht.temperature().getSensor(&sensor);
//  Serial.print("{\"temp\": ");
  Serial.print("{\"t\": \""); Serial.print(sensor.name); Serial.print("\",");
  Serial.print("\"v\": "); Serial.print(sensor.version); Serial.print(",");
//  Serial.print("\"id\": "); Serial.print(sensor.sensor_id); Serial.print(",");
//  Serial.print("\"x\": "); Serial.print(sensor.max_value); Serial.print(",");
//  Serial.print("\"n\": "); Serial.print(sensor.min_value); Serial.print(",");
//  Serial.print("\"r\": "); Serial.print(sensor.resolution); Serial.print("}");
  dht.humidity().getSensor(&sensor);
//  Serial.print("{\"hum\": ");
//  Serial.print("{\"t\": "); Serial.print(sensor.name); Serial.print(",");
//  Serial.print("\"v\": "); Serial.print(sensor.version); Serial.print(",");
//  Serial.print("\"id\": "); Serial.print(sensor.sensor_id); Serial.print(",");
//  Serial.print("\"x\": "); Serial.print(sensor.max_value); Serial.print(",");
//  Serial.print("\"n\": "); Serial.print(sensor.min_value); Serial.print(",");
//  Serial.print("\"r\": "); Serial.print(sensor.resolution); Serial.println("}}");

  delayMS = sensor.min_delay / 1000;
//  Serial.print("{delay: "); Serial.print(delayMS); Serial.println("}}");
  Serial.print("\"d\" : "); Serial.print(delayMS * 4); Serial.print("}}");
  Serial.write(255);          // STOP sensor


  TempHigh = 0;
  TempLow = 1000;
  HumHigh = 0;
  HumLow = 1000;

}

void loop(){
  delay(delayMS * 2);

  sensors_event_t event;
  float temp = 0;
  float hum = 0;
  dht.temperature().getEvent(&event);
  if (isnan(event.temperature)) {
    Serial.println(F("Error reading temperature!"));
  }
  else {
    temp = event.temperature * 10;
    if (temp > TempHigh) TempHigh = temp;
    if (temp < TempLow) TempLow = temp;
//    TempAvg = TempData.reading(temp);
  }
 // Get humidity event and print its value.
  dht.humidity().getEvent(&event);
  if (isnan(event.relative_humidity)) {
    Serial.println(F("Error reading humidity!"));
  }
  else {
    hum = event.relative_humidity * 10;
    if (hum > HumHigh) HumHigh = hum;
    if (hum < HumLow) HumLow = hum;
//    HumAvg = HumData.reading(event.relative_humidity * 10);
  }

  float fTempHigh = (float)TempHigh / 10;
  float fTempLow = (float)TempLow / 10;
  float fHumHigh = (float)HumHigh / 10;
  float fHumLow = (float)HumLow / 10;
  float fTemp = (float)temp / 10;
  float fHum = (float)hum / 10;

  Serial.write(129);             // START Metrics
  Serial.print("{\"metrics\":");
  Serial.print(("{\"temp\": ")); 
  Serial.print((fTemp)) ; 
//  Serial.print((",\"tmin\": ")); 
//  Serial.print((fTempLow));
//  Serial.print((",\"tmax\": ")); 
//  Serial.print((fTempHigh));
  Serial.print((",\"hum\": ")); 
  Serial.print((fHum)); 
//  Serial.print((",\"hmin\": ")); 
//  Serial.print((fHumLow));
//  Serial.print((",\"hmax\": ")); 
//  Serial.print((fHumHigh));
  Serial.print("}}");
  Serial.write(255);            //STOP
 // Serial.println("}");


  display.clearDisplay();
  display.setTextSize(1);
  display.setCursor(8,2);
  display.print("Temperature");
  display.setTextSize(2);
  display.setCursor(25,18);
  display.print(fTemp);
  //display.print(248);
  display.println("C");
  display.setTextSize(1);
  display.setCursor(17,41);
  display.print("Max");
  display.setCursor(10,54);
  display.print(fTempHigh);
  display.setCursor(97,41);
  display.print("Min");
  display.setCursor(90,54);
  display.print(fTempLow);
  display.display();

 delay(delayMS * 2);
 display.clearDisplay();
  display.setTextSize(1);
  display.setCursor(8,2);
  display.print("Humidity");
 display.setTextSize(2);
 display.setCursor(25,18);
 display.print(fHum);
 display.println("%");
 display.setTextSize(1);
  display.setCursor(17,41);
  display.print("Max");
  display.setCursor(10,54);
  display.print(fHumHigh);
  display.setCursor(97,41);
  display.print("Min");
  display.setCursor(90,54);
  display.print(fHumLow);
 display.display();
 
}
