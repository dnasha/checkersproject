let audio: AudioContext | undefined;
export function playSound(
	kind: "move" | "capture" | "king" | "start" | "win",
	enabled: boolean,
): void {
	if (!enabled) return;
	try {
		audio ||= new AudioContext();
		void audio.resume().catch(() => undefined);
		const pitches = {
			move: [260],
			capture: [180, 330],
			king: [392, 523, 659],
			start: [330, 440],
			win: [392, 494, 587, 784],
		}[kind];
		pitches.forEach((pitch, i) => {
			const oscillator = audio!.createOscillator();
			const gain = audio!.createGain();
			const start = audio!.currentTime + i * 0.085;
			oscillator.type = "sine";
			oscillator.frequency.setValueAtTime(pitch, start);
			oscillator.frequency.exponentialRampToValueAtTime(
				pitch * 0.72,
				start + 0.1,
			);
			gain.gain.setValueAtTime(0, start);
			gain.gain.linearRampToValueAtTime(0.07, start + 0.008);
			gain.gain.exponentialRampToValueAtTime(0.001, start + 0.15);
			oscillator.connect(gain);
			gain.connect(audio!.destination);
			oscillator.start(start);
			oscillator.stop(start + 0.17);
		});
	} catch {
		/* Audio support and autoplay permission never affect gameplay. */
	}
}
