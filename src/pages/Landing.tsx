/**
 * Landing Page - SolidJS Version (Stub)
 *
 * TODO: Migrate full version with 3D brain background and animations
 */

import { type Component, type JSX } from 'solid-js'
import { A } from '@solidjs/router'

export const Landing: Component = () => {
  return (
    <div class="relative min-h-screen bg-black">
      {/* Gradient Background */}
      <div class="absolute inset-0 bg-gradient-to-b from-purple-900/20 via-black to-black" />

      {/* Content */}
      <div class="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 py-12">
        {/* Logo */}
        <div class="mb-4 text-center">
          <div class="mb-6 inline-flex">
            <div class="relative">
              <div class="absolute -inset-3 bg-gradient-to-r from-teal-400 to-blue-500 rounded-3xl blur-2xl opacity-30" />
              <div class="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-teal-400 to-blue-500 flex items-center justify-center shadow-2xl">
                <span class="text-3xl">✨</span>
              </div>
            </div>
          </div>

          <h1 class="mb-2 bg-gradient-to-r from-teal-400 via-teal-300 to-blue-400 bg-clip-text text-5xl font-extrabold text-transparent md:text-8xl tracking-tight">
            TENEO
          </h1>
          <p class="text-sm text-gray-400 font-medium tracking-widest uppercase">
            Discovery Portal
          </p>
        </div>

        {/* Tagline */}
        <p class="mb-6 max-w-lg text-center text-lg text-gray-300 leading-relaxed">
          Deploy intelligent agents to explore the neural network.
          <span class="text-teal-400"> Discover hidden spaces.</span>
          <span class="text-yellow-400"> Earn AGI rewards.</span>
        </p>

        {/* Features */}
        <div class="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3 w-full max-w-3xl">
          <FeatureCard
            icon="🧠"
            title="Deploy Agents"
            description="Create and customize agents with unique traits"
            color="teal"
          />
          <FeatureCard
            icon="⚡"
            title="Discover & Earn"
            description="Find undiscovered spaces and earn AGI tokens"
            color="yellow"
          />
          <FeatureCard
            icon="🎯"
            title="Reach AGI"
            description="Help reach 100% neural network exploration"
            color="purple"
          />
        </div>

        {/* CTA Button */}
        <A
          href="/discovery"
          class="group flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-teal-500 to-blue-500 hover:from-teal-400 hover:to-blue-400 text-white text-lg font-semibold rounded-2xl shadow-2xl shadow-teal-500/30 hover:shadow-teal-500/50 transition-all"
        >
          <span>Start Exploring</span>
          <span class="transition-transform group-hover:translate-x-1">→</span>
        </A>

        {/* Status */}
        <p class="mt-8 text-sm text-gray-500">
          SolidJS Migration in Progress
        </p>
      </div>
    </div>
  )
}

interface FeatureCardProps {
  icon: string
  title: string
  description: string
  color: 'teal' | 'yellow' | 'purple'
}

function FeatureCard(props: FeatureCardProps): JSX.Element {
  const colorClasses = {
    teal: 'border-teal-500/20 hover:border-teal-500/40',
    yellow: 'border-yellow-500/20 hover:border-yellow-500/40',
    purple: 'border-purple-500/20 hover:border-purple-500/40',
  }

  return (
    <div
      class={`group relative flex flex-col items-center gap-4 rounded-2xl border ${colorClasses[props.color]} bg-gray-900/60 p-6 backdrop-blur-md transition-all duration-300 hover:scale-105`}
    >
      <div class="text-4xl">{props.icon}</div>
      <div class="text-center space-y-2">
        <h3 class="text-base font-bold text-white">{props.title}</h3>
        <p class="text-sm text-gray-400 leading-relaxed">{props.description}</p>
      </div>
    </div>
  )
}

export default Landing
