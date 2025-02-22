import { createContext, useContext, useEffect, useState } from 'react'
import { IconButton, useTheme } from '@chakra-ui/react'
import { FaSun, FaMoon } from 'react-icons/fa'
import { IconType } from 'react-icons'

type ColorMode = 'light' | 'dark'

interface ColorModeContextType {
  colorMode: ColorMode
  toggleColorMode: () => void
}

const ColorModeContext = createContext<ColorModeContextType>({
  colorMode: 'light',
  toggleColorMode: () => {},
})

export function useColorMode() {
  return useContext(ColorModeContext)
}

export function useColorModeValue<T>(lightValue: T, darkValue: T): T {
  const { colorMode } = useColorMode()
  return colorMode === 'light' ? lightValue : darkValue
}

export function ColorModeProvider({ children }: { children: React.ReactNode }) {
  const [colorMode, setColorMode] = useState<ColorMode>('light')

  useEffect(() => {
    const savedMode = localStorage.getItem('chakra-ui-color-mode') as ColorMode
    if (savedMode) {
      setColorMode(savedMode)
    }
  }, [])

  useEffect(() => {
    localStorage.setItem('chakra-ui-color-mode', colorMode)
    document.documentElement.setAttribute('data-theme', colorMode)
  }, [colorMode])

  const toggleColorMode = () => {
    setColorMode(prev => prev === 'light' ? 'dark' : 'light')
  }

  return (
    <ColorModeContext.Provider value={{ colorMode, toggleColorMode }}>
      {children}
    </ColorModeContext.Provider>
  )
}

export function ColorModeButton() {
  const { colorMode, toggleColorMode } = useColorMode()
  const Icon: IconType = colorMode === 'light' ? FaMoon : FaSun

  return (
    <IconButton
      aria-label="Toggle color mode"
      icon={<Icon />}
      onClick={toggleColorMode}
      size="lg"
      variant="ghost"
    />
  )
} 