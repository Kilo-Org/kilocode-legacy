# Voice Transcription

Use voice input in the chat prompt instead of typing. Voice transcription is an experimental feature in the legacy IDE extensions.

## Requirements

Voice transcription requires:

- The **Speech to Text** experiment enabled in Kilo Code settings
- An OpenAI provider profile with a valid API key
- FFmpeg installed and available on your `PATH`

Install FFmpeg with `brew install ffmpeg` on macOS or `sudo apt install ffmpeg` on Ubuntu and Debian. Windows users can download FFmpeg from [ffmpeg.org](https://ffmpeg.org/download.html) and add it to `PATH`.

## Record a prompt

1. Click the microphone button in the chat prompt.
2. Speak clearly while the audio-level indicator is active.
3. Click the microphone again to stop.
4. Review the transcribed text before sending it.

The feature uses OpenAI realtime transcription, voice activity detection, and identifiers from visible code to improve recognition of project-specific terms.

## Troubleshooting

- If the microphone is unavailable, confirm that the OpenAI API key is configured and FFmpeg can be found.
- Select or refresh the microphone device in **Settings > Speech to Text**.
- Check network connectivity if transcription starts but returns an API error.
