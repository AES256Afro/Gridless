import type { WeatherState } from "./world";

export type SoundscapeMode = "city" | "explore" | "home";

export type SoundscapeProfile = {
  label: "Regional" | "Street" | "Interior";
  focus: "Ambient" | "Event crowd" | "Vehicle" | "Transit" | "Emergency response";
  master: number;
  wind: number;
  urban: number;
  room: number;
  rain: number;
  crowd: number;
  vehicle: number;
  transit: number;
  emergency: number;
};

export type SoundscapeActivity = {
  crowd: number;
  vehicle: number;
  transit: number;
  emergency: number;
};

function bounded(value: number | undefined) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value! : 0));
}

function soundscapeFocus(activity: SoundscapeActivity): SoundscapeProfile["focus"] {
  const cues: Array<[SoundscapeProfile["focus"], number]> = [
    ["Event crowd", activity.crowd],
    ["Vehicle", activity.vehicle],
    ["Transit", activity.transit],
    ["Emergency response", activity.emergency]
  ];
  const strongest = cues.sort((first, second) => second[1] - first[1])[0];
  return strongest[1] >= .12 ? strongest[0] : "Ambient";
}

export function soundscapeProfile(
  mode: SoundscapeMode,
  weather: WeatherState,
  hour: number,
  trafficPressure: number,
  authoredActivity: Partial<SoundscapeActivity> = {}
): SoundscapeProfile {
  const daylight = hour >= 6 && hour < 22 ? 1 : .52;
  const precipitation = weather.kind === "rain" || weather.kind === "snow" ? weather.precipitation : 0;
  const activity: SoundscapeActivity = {
    crowd: bounded(authoredActivity.crowd),
    vehicle: bounded(authoredActivity.vehicle),
    transit: bounded(authoredActivity.transit),
    emergency: bounded(authoredActivity.emergency)
  };
  const focus = soundscapeFocus(activity);
  if (mode === "home") {
    return {
      label: "Interior",
      focus,
      master: .1,
      wind: weather.windKph / 900,
      urban: .008 * daylight,
      room: .055,
      rain: precipitation * .018,
      crowd: activity.crowd * .008,
      vehicle: activity.vehicle * .007,
      transit: activity.transit * .006,
      emergency: activity.emergency * .014
    };
  }
  if (mode === "explore") {
    return {
      label: "Street",
      focus,
      master: .14,
      wind: .012 + weather.windKph / 520,
      urban: (.035 + Math.max(0, Math.min(1, trafficPressure)) * .07) * daylight,
      room: 0,
      rain: precipitation * .12,
      crowd: activity.crowd * .065 * daylight,
      vehicle: activity.vehicle * .055,
      transit: activity.transit * .045,
      emergency: activity.emergency * .075
    };
  }
  return {
    label: "Regional",
    focus,
    master: .09,
    wind: .008 + weather.windKph / 760,
    urban: (.012 + Math.max(0, Math.min(1, trafficPressure)) * .025) * daylight,
    room: 0,
    rain: precipitation * .045,
    crowd: activity.crowd * .018 * daylight,
    vehicle: activity.vehicle * .012,
    transit: activity.transit * .014,
    emergency: activity.emergency * .026
  };
}

export class ProceduralSoundscape {
  private context?: AudioContext;
  private master?: GainNode;
  private wind?: GainNode;
  private urban?: GainNode;
  private room?: GainNode;
  private rain?: GainNode;
  private crowd?: GainNode;
  private vehicle?: GainNode;
  private transit?: GainNode;
  private emergency?: GainNode;
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
    if (!this.context || !this.master || !this.wind || !this.urban || !this.room || !this.rain || !this.crowd || !this.vehicle || !this.transit || !this.emergency) return;
    const now = this.context.currentTime;
    this.master.gain.setTargetAtTime(profile.master, now, .6);
    this.wind.gain.setTargetAtTime(profile.wind, now, .8);
    this.urban.gain.setTargetAtTime(profile.urban, now, .8);
    this.room.gain.setTargetAtTime(profile.room, now, .8);
    this.rain.gain.setTargetAtTime(profile.rain, now, .35);
    this.crowd.gain.setTargetAtTime(profile.crowd, now, .4);
    this.vehicle.gain.setTargetAtTime(profile.vehicle, now, .18);
    this.transit.gain.setTargetAtTime(profile.transit, now, .28);
    this.emergency.gain.setTargetAtTime(profile.emergency, now, .12);
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
    const crowd = makeNoiseLayer("bandpass", 980);

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
    const vehicle = makeTone(46, "sawtooth");
    const transit = makeTone(118, "triangle");
    const sirenOscillator = context.createOscillator();
    sirenOscillator.frequency.value = 720;
    sirenOscillator.type = "sine";
    const sirenSweep = context.createOscillator();
    sirenSweep.frequency.value = .72;
    const sirenRange = context.createGain();
    sirenRange.gain.value = 155;
    const emergency = context.createGain();
    emergency.gain.value = 0;
    sirenSweep.connect(sirenRange).connect(sirenOscillator.frequency);
    sirenOscillator.connect(emergency).connect(master);
    sirenOscillator.start();
    sirenSweep.start();
    this.context = context;
    this.master = master;
    this.wind = wind;
    this.urban = urban;
    this.room = room;
    this.rain = rain;
    this.crowd = crowd;
    this.vehicle = vehicle;
    this.transit = transit;
    this.emergency = emergency;
  }
}
