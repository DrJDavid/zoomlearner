import { extendTheme, type ThemeConfig } from '@chakra-ui/react'

const config: ThemeConfig = {
  initialColorMode: 'light',
  useSystemColorMode: false,
}

export const theme = extendTheme({
  config,
  colors: {
    brand: {
      50: '#f0f9ff',
      100: '#e0f2fe',
      // ... add your brand colors
    },
  },
  components: {
    // Custom component styles
    Button: {
      baseStyle: {
        fontWeight: 'semibold',
      },
      variants: {
        reader: {
          bg: 'brand.500',
          color: 'white',
          _hover: { bg: 'brand.600' },
        },
      },
    },
  },
}) 