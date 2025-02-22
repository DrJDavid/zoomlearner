import {
  VStack,
  HStack,
  IconButton,
  Slider,
  SliderTrack,
  SliderFilledTrack,
  SliderThumb,
  Text,
  Tooltip,
  useColorMode,
} from '@chakra-ui/react'
import { FaPlay, FaPause, FaSun, FaMoon } from 'react-icons/fa'
import { useContext } from 'react'
import { ReaderContext } from '../../store/ReaderContext'

export function Controls() {
  const context = useContext(ReaderContext)
  const { colorMode, toggleColorMode } = useColorMode()

  if (!context) return null
  const { isPlaying, speed, playReader, pauseReader, setReaderSpeed } = context

  return (
    <VStack spacing={4} p={4}>
      <HStack spacing={4} width="full" justify="center">
        <IconButton
          aria-label={isPlaying ? 'Pause' : 'Play'}
          icon={isPlaying ? <FaPause /> : <FaPlay />}
          onClick={() => isPlaying ? pauseReader() : playReader()}
          size="lg"
          variant="reader"
        />
        <IconButton
          aria-label={`Switch to ${colorMode === 'light' ? 'dark' : 'light'} mode`}
          icon={colorMode === 'light' ? <FaMoon /> : <FaSun />}
          onClick={toggleColorMode}
          size="lg"
        />
      </HStack>

      <HStack width="full" spacing={8}>
        <Text minWidth="4rem">{speed} WPM</Text>
        <Tooltip label={`${speed} words per minute`}>
          <Slider
            aria-label="Reading speed"
            value={speed}
            min={60}
            max={1000}
            step={10}
            onChange={setReaderSpeed}
          >
            <SliderTrack>
              <SliderFilledTrack />
            </SliderTrack>
            <SliderThumb />
          </Slider>
        </Tooltip>
      </HStack>
    </VStack>
  )
} 