import { Box, Text, useColorModeValue } from '@chakra-ui/react'
import { useContext } from 'react'
import { ReaderContext } from '../../store/ReaderContext'

export function WordDisplay() {
  const context = useContext(ReaderContext)
  const bg = useColorModeValue('white', 'gray.800')
  const color = useColorModeValue('gray.800', 'white')

  if (!context) return null
  const { currentWord, fontSize } = context

  return (
    <Box
      p={8}
      bg={bg}
      borderRadius="lg"
      boxShadow="lg"
      textAlign="center"
      minH="200px"
      display="flex"
      alignItems="center"
      justifyContent="center"
    >
      <Text
        fontSize={`${fontSize}px`}
        fontWeight="bold"
        color={color}
        transition="all 0.2s"
      >
        {currentWord || 'Ready to read'}
      </Text>
    </Box>
  )
} 