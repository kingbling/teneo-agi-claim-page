import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing'
import { BlendFunction, KernelSize } from 'postprocessing'

interface PostProcessingEffectsProps {
  bloomIntensity?: number
  vignetteIntensity?: number
}

/**
 * PostProcessingEffects - Adds bloom glow and vignette to the 3D scene
 *
 * Bloom creates the characteristic glow around bright particles
 * Vignette adds subtle edge darkening for depth
 */
export function PostProcessingEffects({
  bloomIntensity = 0.8,
  vignetteIntensity = 0.5,
}: PostProcessingEffectsProps) {
  return (
    <EffectComposer multisampling={4}>
      <Bloom
        intensity={bloomIntensity}
        luminanceThreshold={0.6}
        luminanceSmoothing={0.4}
        kernelSize={KernelSize.MEDIUM}
        blendFunction={BlendFunction.SCREEN}
      />
      <Vignette
        offset={0.3}
        darkness={vignetteIntensity}
        blendFunction={BlendFunction.NORMAL}
      />
    </EffectComposer>
  )
}
