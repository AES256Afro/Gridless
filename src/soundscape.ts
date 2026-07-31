import type { WeatherState } from "./world";

export type SoundscapeMode = "city" | "explore" | "home";

export type SoundscapeProfile = {
  label: "Regional" | "Street" | "Interior";
  master: number;
  wind: number;
  urban: number;
  room: number;
  rain: number;
};

export function soundscapeProfile(
  mode: SoundscapeMode,
  weather: WeatherState,
  hour: number,
  trafficPressure: number
): SoundscapeProfile {
  const daylight = hour >= 6 && hour < 22 ? 1 : .52;
  const precipitation = weather.kind === "rain" || weather.kind === "snow" ? weather.precipitation : 0;
  if (mode === "home") {
    return {
      label: "Interior",
      master: .1,
      wind: weather.windKph / 900,
      urban: .008 * daylight,
      room: .055,
      rain: precipitation * .018
    };
  }
  if (mode === "explore") {
    return {
      label: "Street",
      master: .14,
      wind: .012 + weather.windKph / 520,
      urban: (.035 + Math.max(0, Math.min(1, trafficPressure)) * .07) * daylight,
      room: 0,
      rain: precipitation * .12
    };
  }
  return {
    label: "Regional",
    master: .09,
    wind: .008 + weather.windKph / 760,
    urban: (.012 + Math.max(0, Math.min(1, trafficPressure)) * .025) * daylight,
    room: 0,
    rain: precipitation * .045
  };
}

export class ProceduralSoundscape {
  private context?: AudioContext;
  private master?: GainNode;
  private wind?: GainNode;
  private urban?: GainNode;
  private room?: GainNode;
  private rain?: GainNode;
  private active = false;
  private profile?: SoundscapeProfile;

  get enabled() {
    return this.active;
  }

  async enable() {
    if (!this.context) this.build();
    await this.context?.resume();
    this.active = true;
    if (this.profile) this.apply(this.profile);
  }

  disable() {
    this.active = false;
    if (this.context && this.master) this.master.gain.setTargetAtTime(0, this.context.currentTime, .08);
  }

  update(profile: SoundscapeProfile) {
    this.profile = profile;
    if (this.active) this.apply(profile);
  }

  private apply(profile: SoundscapeProfile) {
    if (!this.context || !this.master || !this.wind || !this.urban || !this.room || !this.rain) return;
    const now = this.context.currentTime;
    this.master.gain.setTargetAtTime(profile.master, now, .6);
    this.wind.gain.setTargetAtTime(profile.wind, now, .8);
    this.urban.gain.setTargetAtTime(profile.urban, now, .8);
    this.room.gain.setTargetAtTime(profile.room, now, .8);
    this.rain.gain.setTargetAtTime(profile.rain, now, .35);
  }

  private build() {
    const AudioContextConstructor = window.AudioContext
      ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextConstructor) return;
    const context = new AudioContextConstructor();
    const master = context.createGain();
    master.gain.value = 0;
    master.connect(context.destination);

    const noiseBuffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
    const noise = noiseBuffer.getChannelData(0);
    let seed = 0x4f1bbcdc;
    for (let index = 0; index < noise.length; index++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      noise[index] = seed / 0xffffffff * 2 - 1;
    }
    const makeNoiseLayer = (filterType: BiquadFilterType, frequency: number) => {
      const source = context.createBufferSource();
      source.buffer = noiseBuffer;
      source.loop = true;
      const filter = context.createBiquadFilter();
      filter.type = filterType;
      filter.frequency.value = frequency;
      const gain = context.createGain();
      gain.gain.value = 0;
      source.connect(filter).connect(gain).connect(master);
      source.start();
      return gain;
    };
    const wind = makeNoiseLayer("lowpass", 520);
    const rain = makeNoiseLayer("highpass", 2400);

    const makeTone = (frequency: number, type: OscillatorType) => {
      const oscillator = context.createOscillator();
      oscillator.frequency.value = frequency;
      oscillator.type = type;
      const gain = context.createGain();
      gain.gain.value = 0;
      oscillator.connect(gain).connect(master);
      oscillator.start();
      return gain;
    };
    const urban = makeTone(54, "triangle");
    const room = makeTone(92, "sine");
    this.context = context;
    this.master = master;
    this.wind = wind;
    this.urban = urban;
    this.room = room;
    this.rain = rain;
  }
}
