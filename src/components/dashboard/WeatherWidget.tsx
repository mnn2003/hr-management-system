import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, } from '@/components/ui/dialog';
import { Cloud, CloudRain, Sun, Snowflake, Wind, Droplets, Eye, ThermometerSun, MapPin, ChevronRight, Loader2, CloudSun, CloudMoon, Moon, CloudLightning, CloudFog, Clock, Calendar, } from 'lucide-react';
import { format } from 'date-fns';

interface WeatherData {
  current: {
    temp: number;
    feels_like: number;
    humidity: number;
    wind_speed: number;
    wind_deg: number;
    visibility: number;
    uvi: number;
    pressure: number;
    dew_point: number;
    clouds: number;
    weather: Array<{
      id: number;
      main: string;
      description: string;
      icon: string;
    }>;
    dt: number;
    sunrise: number;
    sunset: number;
  };
  hourly: Array<{
    dt: number;
    temp: number;
    weather: Array<{
      id: number;
      main: string;
      description: string;
      icon: string;
    }>;
    pop: number;
  }>;
  daily: Array<{
    dt: number;
    temp: {
      min: number;
      max: number;
      day?: number;
    };
    weather: Array<{
      id: number;
      main: string;
      description: string;
      icon: string;
    }>;
    pop: number;
    sunrise: number;
    sunset: number;
  }>;
  cityName?: string;
}

interface WeatherWidgetProps {
  latitude: number;
  longitude: number;
  locationError?: string | null;
}

// Free OpenWeatherMap API key
const API_KEY = '0be8a33c4af5b1f6034e5206298aadeb';

const WeatherWidget = ({ latitude, longitude, locationError }: WeatherWidgetProps) => {
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [cityName, setCityName] = useState<string>('Your Location');

  useEffect(() => {
    if (latitude && longitude) {
      fetchWeatherData();
      fetchCityName();
    }
  }, [latitude, longitude]);

  const fetchCityName = async () => {
    try {
      const response = await fetch(
        `https://api.openweathermap.org/geo/1.0/reverse?lat=${latitude}&lon=${longitude}&limit=1&appid=${API_KEY}`
      );
      
      if (response.ok) {
        const data = await response.json();
        if (data && data.length > 0) {
          const city = data[0].name;
          const country = data[0].country;
          setCityName(`${city}, ${country}`);
        }
      }
    } catch (error) {
      console.error('Error fetching city name:', error);
    }
  };

  const fetchWeatherData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Get current weather and forecast in one call using One Call API 3.0
      // Note: This requires a different endpoint and might need a different API key
      // For now, we'll use the free endpoints
      
      // Get current weather
      const currentResponse = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&units=metric&appid=${API_KEY}`
      );
      
      if (!currentResponse.ok) {
        const errorData = await currentResponse.json();
        console.error('Current Weather API Error:', errorData);
        throw new Error(errorData.message || 'Failed to fetch current weather');
      }
      
      const currentData = await currentResponse.json();
      
      // Get 5-day forecast
      const forecastResponse = await fetch(
        `https://api.openweathermap.org/data/2.5/forecast?lat=${latitude}&lon=${longitude}&units=metric&appid=${API_KEY}`
      );
      
      if (!forecastResponse.ok) {
        const errorData = await forecastResponse.json();
        console.error('Forecast API Error:', errorData);
        throw new Error(errorData.message || 'Failed to fetch forecast');
      }
      
      const forecastData = await forecastResponse.json();
      
      // Process hourly forecast (next 24 hours)
      const hourlyForecast = forecastData.list.slice(0, 24).map((item: any) => ({
        dt: item.dt,
        temp: item.main.temp,
        weather: item.weather,
        pop: item.pop || 0,
      }));
      
      // Process daily forecast (group by day)
      const dailyMap = new Map();
      forecastData.list.forEach((item: any) => {
        const date = new Date(item.dt * 1000).toDateString();
        if (!dailyMap.has(date)) {
          dailyMap.set(date, {
            temps: [],
            weather: item.weather,
            pop: item.pop || 0,
            dt: item.dt,
            // Store the first occurrence's weather for the day
            weatherIcon: item.weather[0],
          });
        }
        dailyMap.get(date).temps.push(item.main.temp);
        // Keep the highest pop for the day
        if (item.pop > dailyMap.get(date).pop) {
          dailyMap.get(date).pop = item.pop;
        }
      });
      
      const dailyForecast = Array.from(dailyMap.values()).map((day: any) => ({
        dt: day.dt,
        temp: {
          min: Math.min(...day.temps),
          max: Math.max(...day.temps),
          day: day.temps[Math.floor(day.temps.length / 2)], // Approximate day temperature
        },
        weather: [day.weatherIcon], // Use the weather from midday
        pop: day.pop,
        sunrise: currentData.sys?.sunrise || 0,
        sunset: currentData.sys?.sunset || 0,
      })).slice(0, 7);
      
      const transformedData: WeatherData = {
        current: {
          dt: currentData.dt,
          temp: currentData.main.temp,
          feels_like: currentData.main.feels_like,
          humidity: currentData.main.humidity,
          wind_speed: currentData.wind.speed,
          wind_deg: currentData.wind.deg,
          visibility: currentData.visibility,
          uvi: 0,
          pressure: currentData.main.pressure,
          dew_point: 0,
          clouds: currentData.clouds.all,
          weather: currentData.weather,
          sunrise: currentData.sys?.sunrise || 0,
          sunset: currentData.sys?.sunset || 0,
        },
        hourly: hourlyForecast,
        daily: dailyForecast,
        cityName: cityName,
      };
      
      setWeatherData(transformedData);
    } catch (err) {
      console.error('Error fetching weather:', err);
      setError(err instanceof Error ? err.message : 'Unable to load weather data');
    } finally {
      setLoading(false);
    }
  };

  // Helper function to determine if it's day or night for a given timestamp
  const isDayTime = (timestamp: number, sunrise?: number, sunset?: number): boolean => {
    // If we have specific sunrise/sunset for this day, use them
    if (sunrise && sunset) {
      return timestamp >= sunrise && timestamp < sunset;
    }
    
    // Default day/night based on typical hours (6 AM - 6 PM)
    const hours = new Date(timestamp * 1000).getHours();
    return hours >= 6 && hours < 18;
  };

  const getWeatherIcon = (weatherId: number, timestamp: number, sunrise?: number, sunset?: number) => {
    const isDay = isDayTime(timestamp, sunrise, sunset);
    
    // Thunderstorm (200-299)
    if (weatherId >= 200 && weatherId < 300) return <CloudLightning className="h-6 w-6 text-purple-300" />;
    
    // Drizzle (300-399)
    if (weatherId >= 300 && weatherId < 400) return <CloudRain className="h-6 w-6 text-blue-300" />;
    
    // Rain (500-599)
    if (weatherId >= 500 && weatherId < 600) return <CloudRain className="h-6 w-6 text-blue-400" />;
    
    // Snow (600-699)
    if (weatherId >= 600 && weatherId < 700) return <Snowflake className="h-6 w-6 text-blue-100" />;
    
    // Atmosphere (700-799) - fog, mist, etc.
    if (weatherId >= 700 && weatherId < 800) return <CloudFog className="h-6 w-6 text-gray-300" />;
    
    // Clear (800)
    if (weatherId === 800) {
      return isDay 
        ? <Sun className="h-6 w-6 text-yellow-300" />
        : <Moon className="h-6 w-6 text-gray-300" />;
    }
    
    // Clouds (801-899)
    if (weatherId > 800) {
      return isDay 
        ? <CloudSun className="h-6 w-6 text-gray-300" />
        : <CloudMoon className="h-6 w-6 text-gray-400" />;
    }
    
    // Default
    return <Cloud className="h-6 w-6 text-gray-300" />;
  };

  const getWeatherGradient = (weatherMain: string, isDay: boolean = true) => {
    const baseGradients = {
      clear: isDay 
        ? 'from-blue-400 via-blue-300 to-sky-400'
        : 'from-indigo-900 via-purple-900 to-blue-900',
      clouds: isDay
        ? 'from-slate-500 via-slate-400 to-gray-500'
        : 'from-slate-700 via-slate-800 to-gray-900',
      rain: isDay
        ? 'from-blue-600 via-blue-500 to-indigo-600'
        : 'from-blue-800 via-indigo-900 to-purple-900',
      drizzle: isDay
        ? 'from-blue-600 via-blue-500 to-indigo-600'
        : 'from-blue-800 via-indigo-900 to-purple-900',
      snow: isDay
        ? 'from-slate-200 via-blue-100 to-slate-300'
        : 'from-slate-300 via-blue-200 to-slate-400',
      thunderstorm: isDay
        ? 'from-purple-700 via-purple-600 to-indigo-700'
        : 'from-purple-900 via-indigo-900 to-blue-900',
    };

    switch (weatherMain?.toLowerCase()) {
      case 'clear':
        return baseGradients.clear;
      case 'clouds':
        return baseGradients.clouds;
      case 'rain':
      case 'drizzle':
        return baseGradients.rain;
      case 'snow':
        return baseGradients.snow;
      case 'thunderstorm':
        return baseGradients.thunderstorm;
      default:
        return isDay 
          ? 'from-emerald-400 via-teal-400 to-cyan-500'
          : 'from-emerald-800 via-teal-800 to-cyan-800';
    }
  };

  if (loading) {
    return (
      <Card className="border-0 overflow-hidden bg-gradient-to-r from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900">
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-slate-600 dark:text-slate-400" />
        </CardContent>
      </Card>
    );
  }

  if (error || locationError || !weatherData) {
    return (
      <Card className="border-0 overflow-hidden bg-gradient-to-r from-rose-50 to-orange-50 dark:from-rose-950/20 dark:to-orange-950/20">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Cloud className="h-8 w-8 text-rose-400" />
              <div>
                <p className="text-sm font-medium text-rose-600 dark:text-rose-400">
                  {error || locationError || 'Weather data unavailable'}
                </p>
              </div>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={fetchWeatherData}
              className="border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-400"
            >
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const current = weatherData.current;
  const isCurrentlyDay = isDayTime(current.dt, current.sunrise, current.sunset);
  const todayHourly = weatherData.hourly.slice(0, 8);
  const weeklyForecast = weatherData.daily.slice(0, 7);

  return (
    <Card className="border-0 overflow-hidden group hover:shadow-xl transition-all duration-300">
      <div className={`bg-gradient-to-br ${getWeatherGradient(current.weather[0]?.main, isCurrentlyDay)} p-6 text-white`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="bg-white/10 p-3 rounded-2xl backdrop-blur-sm border border-white/20">
              {getWeatherIcon(current.weather[0]?.id, current.dt, current.sunrise, current.sunset)}
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <MapPin className="h-4 w-4 text-white/80" />
                <span className="text-sm font-medium text-white/90">{cityName}</span>
              </div>
              <div className="flex items-baseline gap-3">
                <span className="text-5xl font-bold tracking-tighter">
                  {Math.round(current.temp)}°
                </span>
                <span className="text-xl font-light capitalize">
                  {current.weather[0]?.description}
                </span>
              </div>
              <div className="flex items-center gap-4 mt-3 text-white/90">
                <span className="flex items-center gap-1.5 text-sm">
                  <ThermometerSun className="h-4 w-4" />
                  <span>Feels like {Math.round(current.feels_like)}°</span>
                </span>
                <span className="w-1 h-1 rounded-full bg-white/50" />
                <span className="flex items-center gap-1.5 text-sm">
                  <Droplets className="h-4 w-4" />
                  <span>{current.humidity}%</span>
                </span>
                <span className="w-1 h-1 rounded-full bg-white/50" />
                <span className="flex items-center gap-1.5 text-sm">
                  <Wind className="h-4 w-4" />
                  <span>{Math.round(current.wind_speed)} km/h</span>
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button 
                  variant="secondary" 
                  className="bg-white/20 hover:bg-white/30 text-white border-0 backdrop-blur-sm font-medium"
                >
                  Details
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-xl">
                    <MapPin className="h-5 w-5 text-primary" />
                    Weather Forecast for {cityName}
                  </DialogTitle>
                </DialogHeader>
                
                <div className="space-y-6 py-4">
                  {/* Current Weather Details */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 p-4 rounded-xl">
                      <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-1">
                        <ThermometerSun className="h-4 w-4" />
                        <span className="text-xs font-medium">Feels Like</span>
                      </div>
                      <p className="text-xl font-bold text-blue-700 dark:text-blue-300">{Math.round(current.feels_like)}°C</p>
                    </div>
                    <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 p-4 rounded-xl">
                      <div className="flex items-center gap-2 text-green-600 dark:text-green-400 mb-1">
                        <Droplets className="h-4 w-4" />
                        <span className="text-xs font-medium">Humidity</span>
                      </div>
                      <p className="text-xl font-bold text-green-700 dark:text-green-300">{current.humidity}%</p>
                    </div>
                    <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30 p-4 rounded-xl">
                      <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 mb-1">
                        <Wind className="h-4 w-4" />
                        <span className="text-xs font-medium">Wind Speed</span>
                      </div>
                      <p className="text-xl font-bold text-purple-700 dark:text-purple-300">{Math.round(current.wind_speed)} km/h</p>
                    </div>
                    <div className="bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/30 p-4 rounded-xl">
                      <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400 mb-1">
                        <Eye className="h-4 w-4" />
                        <span className="text-xs font-medium">Visibility</span>
                      </div>
                      <p className="text-xl font-bold text-orange-700 dark:text-orange-300">{(current.visibility / 1000).toFixed(1)} km</p>
                    </div>
                  </div>

                  {/* Sunrise/Sunset Times */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-950/30 dark:to-orange-950/30 p-4 rounded-xl">
                      <p className="text-xs font-medium text-yellow-600 dark:text-yellow-400 mb-1">Sunrise</p>
                      <p className="text-lg font-bold text-yellow-700 dark:text-yellow-300">
                        {format(new Date(current.sunrise * 1000), 'h:mm a')}
                      </p>
                    </div>
                    <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 p-4 rounded-xl">
                      <p className="text-xs font-medium text-indigo-600 dark:text-indigo-400 mb-1">Sunset</p>
                      <p className="text-lg font-bold text-indigo-700 dark:text-indigo-300">
                        {format(new Date(current.sunset * 1000), 'h:mm a')}
                      </p>
                    </div>
                  </div>

                  {/* Hourly Forecast */}
                  <div>
                    <h4 className="font-semibold text-lg mb-3 flex items-center gap-2">
                      <Clock className="h-5 w-5 text-primary" />
                      Today's Hourly Forecast
                    </h4>
                    <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                      {todayHourly.map((hour, index) => {
                        const hourTime = new Date(hour.dt * 1000);
                        return (
                          <div key={index} className="text-center p-3 bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-800/50 dark:to-gray-900/50 rounded-xl hover:shadow-md transition-shadow">
                            <p className="text-xs font-medium text-gray-600 dark:text-gray-400">
                              {format(hourTime, 'ha')}
                            </p>
                            <div className="my-2 flex justify-center">
                              {getWeatherIcon(hour.weather[0]?.id, hour.dt, current.sunrise, current.sunset)}
                            </div>
                            <p className="text-sm font-bold text-gray-800 dark:text-gray-200">{Math.round(hour.temp)}°</p>
                            {hour.pop > 0 && (
                              <p className="text-xs font-medium text-blue-500 dark:text-blue-400">{Math.round(hour.pop * 100)}%</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* 7-Day Forecast */}
                  <div>
                    <h4 className="font-semibold text-lg mb-3 flex items-center gap-2">
                      <Calendar className="h-5 w-5 text-primary" />
                      7-Day Forecast
                    </h4>
                    <div className="space-y-2">
                      {weeklyForecast.map((day, index) => {
                        // Use noon time for each day to show appropriate day icons
                        const dayDate = new Date(day.dt * 1000);
                        const noonTime = Math.floor(dayDate.setHours(12, 0, 0, 0) / 1000);
                        
                        return (
                          <div key={index} className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800/50 dark:to-gray-900/50 rounded-xl hover:shadow-md transition-shadow">
                            <div className="w-24">
                              <p className="font-semibold text-gray-800 dark:text-gray-200">
                                {index === 0 ? 'Today' : format(dayDate, 'EEE')}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {format(dayDate, 'MMM d')}
                              </p>
                            </div>
                            <div className="flex items-center gap-3 flex-1 ml-4">
                              {getWeatherIcon(day.weather[0]?.id, noonTime, day.sunrise, day.sunset)}
                              <span className="text-sm capitalize text-gray-700 dark:text-gray-300 w-24">{day.weather[0]?.description}</span>
                            </div>
                            <div className="flex items-center gap-4">
                              <span className="text-sm text-gray-500 dark:text-gray-400">{Math.round(day.temp.min)}°</span>
                              <div className="w-24 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-gradient-to-r from-blue-400 to-red-400 rounded-full"
                                  style={{
                                    width: `${((day.temp.max - day.temp.min) / 30) * 100}%`,
                                    marginLeft: `${((day.temp.min - -10) / 40) * 100}%`
                                  }}
                                />
                              </div>
                              <span className="text-sm font-bold text-gray-800 dark:text-gray-200 w-12">{Math.round(day.temp.max)}°</span>
                            </div>
                            {day.pop > 0.1 && (
                              <Badge variant="secondary" className="ml-2 bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                                {Math.round(day.pop * 100)}%
                              </Badge>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Additional Weather Info */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <div className="text-center">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">UV Index</p>
                      <p className="font-semibold text-gray-800 dark:text-gray-200">N/A</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Pressure</p>
                      <p className="font-semibold text-gray-800 dark:text-gray-200">{current.pressure} hPa</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Dew Point</p>
                      <p className="font-semibold text-gray-800 dark:text-gray-200">N/A</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Cloud Cover</p>
                      <p className="font-semibold text-gray-800 dark:text-gray-200">{current.clouds}%</p>
                    </div>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default WeatherWidget;
