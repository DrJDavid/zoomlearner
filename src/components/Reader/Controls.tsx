import {
  VStack,
  HStack,
  Button,
  Slider as ChakraSlider,
  SliderTrack,
  SliderFilledTrack as ChakraSliderFilledTrack,
  SliderThumb as ChakraSliderThumb,
  Text,
  Box,
  useColorMode,
} from '@chakra-ui/react'
import { IconType } from 'react-icons'
import { FaPlay, FaPause, FaSun, FaMoon } from 'react-icons/fa'
import { useContext } from 'react'
import { ReaderContext } from '../../store/ReaderContext'

export function Controls() {
  const context = useContext(ReaderContext)
  if (!context) return null
  
  const { isPlaying, speed, playReader, pauseReader, setReaderSpeed } = context
  const { colorMode, toggleColorMode } = useColorMode()
  const isDark = colorMode === 'dark'

  const PlayIcon = isPlaying ? FaPause : FaPlay
  const ThemeIcon = isDark ? FaSun : FaMoon

  return (
    <VStack gap={4} align="stretch">
      <HStack gap={4} justify="center">
        <Button
          onClick={() => isPlaying ? pauseReader() : playReader()}
          colorScheme="blue"
          size="md"
          leftIcon={<PlayIcon />}
        >
          {isPlaying ? 'Pause' : 'Play'}
        </Button>
        <Button
          onClick={toggleColorMode}
          size="md"
          leftIcon={<ThemeIcon />}
        >
          {isDark ? 'Light' : 'Dark'}
        </Button>
      </HStack>
      <Box px={4}>
        <Text mb={2}>Reading Speed: {speed} WPM</Text>
        <ChakraSlider
          aria-label="reading-speed-slider"
          value={speed}
          min={100}
          max={800}
          step={10}
          onChange={setReaderSpeed}
          focusThumbOnChange={false}
        >
          <SliderTrack>
            <ChakraSliderFilledTrack />
          </SliderTrack>
          <ChakraSliderThumb />
        </ChakraSlider>
      </Box>
    </VStack>
  )
} 