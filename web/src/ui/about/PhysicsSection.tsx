import {
  fn,
  frac,
  gap,
  lines,
  inline,
  math,
  mi,
  mn,
  mo,
  mover,
  mtext,
  paren,
  row,
  sqrt,
  sub,
  subsup,
  sup,
  t,
  up,
} from './math.ts';
import { Cite, Equation, Item, Items, Prose, Sub, Why, Xref } from './prose.tsx';
import type { AboutSection } from './section.ts';

/**
 * The equations the scene is computed with: each displayed, its symbols named, the file
 * that evaluates it and the paper it comes from. Only what the code really does -- every
 * formula here was read off the file it names.
 */
export const physicsSection: AboutSection = {
  id: 'physics',
  tab: 'Physics',
  title: 'How things are computed',
  blurb:
    'The equations behind the picture: what each says, what its symbols are, where it is evaluated in the code and where it comes from.',
  subsections: [
    { id: 'interpolation', label: 'Between the samples' },
    { id: 'kepler', label: 'Kepler’s equation' },
    { id: 'conics', label: 'Comets: any conic' },
    { id: 'third-law', label: 'Kepler’s third law' },
    { id: 'sky-orbits', label: 'Orbits on the sky' },
    { id: 'rotation', label: 'Rotation' },
    { id: 'light-time', label: 'Light time' },
    { id: 'magnitudes', label: 'Magnitudes' },
    { id: 'colour', label: 'Star colour' },
    { id: 'sun', label: 'The Sun’s light' },
    { id: 'earth', label: 'Earth’s air and sea' },
    { id: 'saturn', label: 'Saturn’s shadows' },
    { id: 'satellites', label: 'Satellites: SGP4' },
    { id: 'black-holes', label: 'Black holes' },
    { id: 'galaxy', label: 'The galaxy' },
  ],
  Body: () => {
    const log10 = (...argument: Parameters<typeof row>) => row(sub(up('log'), mn('10')), paren(...argument));
    return (
      <>
        <Sub section="physics" id="interpolation">
          Between the samples
        </Sub>
        <Equation
          title="Cubic Hermite interpolation"
          cite="horizons"
          code="web/src/core/hermite.ts"
          math={math(
            lines(
              row(
                mi('x'),
                paren(mi('s')),
                mo('='),
                sub(mi('h'), mn('00')),
                sub(mi('x'), mn('0')),
                mo('+'),
                sub(mi('h'), mn('10')),
                mi('Δt'),
                sub(mi('v'), mn('0')),
                mo('+'),
                sub(mi('h'), mn('01')),
                sub(mi('x'), mn('1')),
                mo('+'),
                sub(mi('h'), mn('11')),
                mi('Δt'),
                sub(mi('v'), mn('1')),
              ),
              row(
                sub(mi('h'), mn('00')),
                mo('='),
                t('2 s^3 − 3 s^2 + 1'),
                mo(','),
                gap('0.6em'),
                sub(mi('h'), mn('10')),
                mo('='),
                t('s^3 − 2 s^2 + s'),
              ),
              row(
                sub(mi('h'), mn('01')),
                mo('='),
                t('− 2 s^3 + 3 s^2'),
                mo(','),
                gap('0.6em'),
                sub(mi('h'), mn('11')),
                mo('='),
                t('s^3 − s^2'),
              ),
            ),
          )}
          symbols={
            <>
              x₀, v₀ and x₁, v₁ the positions and velocities JPL gives at the samples either side; Δt the step
              between them; s from 0 to 1 across it.
            </>
          }
        >
          Every body in the tables is placed this way, every frame. The velocity stored at each sample is the
          curve’s slope there, and that is what it buys: measured against JPL at 1-hour resolution, plain
          linear interpolation misplaces Mercury by 44,884 km, cubic Hermite by 9.7 km. Worst case over the
          planets: Earth 32 m, Pluto 5.1 km, Mercury 9.7 km.
        </Equation>

        <Sub section="physics" id="kepler">
          Kepler’s equation
        </Sub>
        <Equation
          title="Kepler’s equation, for where along an ellipse a body is"
          code={['web/src/core/kepler.ts', 'web/src/scene/beltShader.ts', 'web/src/scene/satelliteShader.ts']}
          math={math(
            row(
              t('M = E − e sin E'),
              gap(),
              t('M = n ( t − τ )'),
              gap(),
              mi('r'),
              mo('='),
              t('a ( 1 − e cos E )'),
            ),
          )}
          symbols={
            <>
              M the mean anomaly, growing evenly with time at the mean motion n from the periapsis time τ; E
              the eccentric anomaly; e the eccentricity; a the semi-major axis; r the distance from the focus.
            </>
          }
        >
          Solved for E by Newton’s method. Its usual start, M + e sin M, diverges near perihelion above e =
          0.99, so above e = 0.5 the start is the root of the cubic{' '}
          {inline(t('( e / 6 ) E^3 + ( 1 − e ) E = M'))} — sin E cut at its cubic term, exact in the limit
          that matters — by Cardano’s formula. Measured over e from 0 to 0.99999: at most five evaluations,
          residual at worst 4.4 × 10⁻¹⁶ rad. Used wherever a body is propagated rather than looked up: outside
          the downloaded window, the asteroid belt (on the graphics card, in float32, with fixed Newton
          steps), the satellite dots, the planets of other stars, S2 and the Gaia black holes’ stars.
        </Equation>
        <Equation
          title="An orbit from a position and a velocity"
          code="web/src/core/kepler.ts (stateToOsculatingElements)"
          math={math(
            row(
              mi('ε'),
              mo('='),
              frac(sup(mi('v'), mn('2')), mn('2')),
              mo('−'),
              frac(mi('μ'), mi('r')),
              gap(),
              mi('a'),
              mo('='),
              mo('−'),
              frac(mi('μ'), row(mn('2'), mi('ε'))),
              gap(),
              mi('𝐞'),
              mo('='),
              frac(
                row(
                  paren(sup(mi('v'), mn('2')), mo('−'), frac(mi('μ'), mi('r'))),
                  mi('𝐫'),
                  mo('−'),
                  paren(mi('𝐫'), mo('·'), mi('𝐯')),
                  mi('𝐯'),
                ),
                mi('μ'),
              ),
            ),
          )}
          symbols={
            <>
              𝐫 and 𝐯 the body’s position and velocity relative to what it orbits; μ that body’s GM; ε the
              orbital energy (vis-viva); 𝐞 the eccentricity vector, pointing at periapsis. The plane is the
              one square to 𝐫 × 𝐯.
            </>
          }
        >
          Orbits drawn as osculating ellipses around whatever each body orbits — the Sun for a planet, the
          planet alone for a moon — re-derived from the body’s own state as it moves, so the line always
          passes through it. Proxima’s orbit about Alpha Centauri A and B is worked out the same way, from its
          position and velocity relative to their barycentre.
        </Equation>

        <Sub section="physics" id="conics">
          Comets: any conic
        </Sub>
        <Equation
          title="Kepler’s equation in universal variables"
          cite="conway1986"
          code={['web/src/core/conic.ts', 'web/src/core/comets.ts']}
          math={math(
            lines(
              row(
                sqrt(mi('μ')),
                mi('t'),
                mo('='),
                mi('e'),
                sup(mi('χ'), mn('3')),
                mi('S'),
                paren(mi('z')),
                mo('+'),
                mi('q'),
                mi('χ'),
                gap(),
                t('z = α'),
                sup(mi('χ'), mn('2')),
                mo(','),
                gap('0.5em'),
                mi('α'),
                mo('='),
                frac(t('1 − e'), mi('q')),
              ),
              row(
                mi('S'),
                paren(mi('z')),
                mo('='),
                frac(row(sqrt(mi('z')), mo('−'), fn('sin'), sqrt(mi('z'))), sup(mi('z'), mn('3/2'))),
                mo(','),
                gap(),
                mi('C'),
                paren(mi('z')),
                mo('='),
                frac(row(mn('1'), mo('−'), fn('cos'), sqrt(mi('z'))), mi('z')),
              ),
            ),
          )}
          symbols={
            <>
              t the time from perihelion; q the perihelion distance; χ the universal anomaly; S and C
              Stumpff’s functions, smooth through z = 0 (by their series near it).
            </>
          }
        >
          A comet near e = 1 is where the three textbook equations each go wrong — the ellipse’s needs a
          semi-major axis that runs to infinity, Barker’s holds only at e exactly 1, the hyperbolic one
          cancels catastrophically. In this form the ellipse, the parabola and the hyperbola are one curve,
          and e = 0.999, 1 and 1.001 three nearby points on it. Solved by Laguerre’s iteration, the position
          following from the Lagrange coefficients f and g: no semi-major axis anywhere, so nothing to blow
          up. In double precision, on the processor, a few microseconds a comet.
        </Equation>

        <Sub section="physics" id="third-law">
          Kepler’s third law
        </Sub>
        <Equation
          title="Orbit size from period and mass"
          code={['web/src/core/exoplanetArchive.ts', 'web/src/core/blackHoles.ts']}
          math={math(
            row(
              sup(mi('a'), mn('3')),
              mo('='),
              frac(
                row(
                  mi('G'),
                  paren(sub(mi('M'), mn('1')), mo('+'), sub(mi('M'), mn('2'))),
                  sup(mi('P'), mn('2')),
                ),
                row(mn('4'), sup(mi('π'), mn('2'))),
              ),
              gap(),
              mtext('or, in AU, years and Suns,'),
              gap('0.5em'),
              sup(mi('a'), mn('3')),
              mo('='),
              mi('M'),
              sup(mi('P'), mn('2')),
            ),
          )}
          symbols={<>a the semi-major axis, P the period, M₁ and M₂ the two masses.</>}
        >
          An Archive planet with a period but no orbit size takes its size from its star’s mass this way, and
          the reverse. Gaia BH1’s and BH3’s separations are not taken from the papers but from this, with the
          period and the two masses, so the orbit drawn and the motion along it agree: 1.396 AU for BH1
          against their 1.40, and BH3’s star 16.18 AU from the barycentre against their 16.17 ± 0.27.
        </Equation>

        <Sub section="physics" id="sky-orbits">
          Orbits on the sky
        </Sub>
        <Equation
          title="Thiele–Innes: an orbit as seen from the Sun"
          code={[
            'web/src/core/exoplanets.ts (skyOffsetKm)',
            'web/src/core/alphaCentauri.ts',
            'web/src/core/blackHoles.ts',
          ]}
          math={math(
            lines(
              t('north = r ( cos u cos Ω − sin u sin Ω cos i )'),
              t('east = r ( cos u sin Ω + sin u cos Ω cos i )'),
              row(t('away = r sin u sin i'), gap(), t('u = f + ω')),
            ),
          )}
          symbols={
            <>
              r the distance from the star; f the true anomaly; ω the argument of periastron; Ω the position
              angle of the ascending node, east of north; i the tilt to the sky; u the argument of latitude.
              The ascending node is where the body moves away from us.
            </>
          }
        >
          The visual-binary convention, used for every orbit measured on the sky: Alpha Centauri A and B, S2
          about Sgr A*, Gaia BH1’s and BH3’s stars, and the planets of other stars. Inferior conjunction — a
          planet straight between its star and the Sun — is u = −90°. Where i or Ω is not measured, the
          conventions in{' '}
          <Xref to="estimated" sub="exoplanets">
            Not known › Planets of other stars
          </Xref>{' '}
          fill them.
        </Equation>

        <Sub section="physics" id="rotation">
          Rotation
        </Sub>
        <Equation
          title="IAU rotational elements"
          cite="archinal2018"
          code="web/src/scene/orientation.ts"
          math={math(
            row(
              mi('W'),
              mo('='),
              sub(mi('W'), mn('0')),
              mo('+'),
              mover('W'),
              mi('d'),
              gap(),
              paren(sub(mi('α'), mn('0')), mo(','), sub(mi('δ'), mn('0'))),
              gap(),
              t('ε = 84381.448″'),
            ),
          )}
          symbols={
            <>
              (α₀, δ₀) where the north pole points in the ICRF equatorial frame; W the angle from the body’s
              ascending node on the ICRF equator, east along its own equator, to its prime meridian; d days
              from J2000 TDB; ε the obliquity that turns the equatorial frame into the ecliptic one the
              ephemerides arrive in — the IAU 1976 value, the one JPL defines its ecliptic of J2000 with.
            </>
          }
        />

        <Sub section="physics" id="light-time">
          Light time
        </Sub>
        <Equation
          title="Light time"
          code="web/src/core/ephemerisStore.ts (lightTimeSeconds)"
          math={math(row(mi('τ'), mo('='), frac(mi('d'), mi('c')), gap(), t('c = 299,792.458 ~km/s')))}
          symbols={<>d the distance between two bodies now; c the speed of light, exact by definition.</>}
        >
          Light time and relative speeds, computed from the same vectors. Purely geometric: it answers “how
          far is it in light seconds right now”, not “when did the light I am seeing leave”.
        </Equation>

        <Sub section="physics" id="magnitudes">
          Magnitudes
        </Sub>
        <Equation
          title="The distance modulus"
          code="web/src/core/stars3d.ts (apparentMagnitude)"
          math={math(row(mi('m'), mo('='), mi('M'), mo('+'), mn('5'), log10(frac(mi('d'), t('10 ~pc')))))}
          symbols={
            <>
              m how bright a star looks from where the camera is; M how bright it would look from 10 parsecs;
              d its distance from the camera.
            </>
          }
        >
          How every 3D star’s brightness is worked out from wherever the camera is: from the Sun, the same sky
          as the catalogue’s; from Alpha Centauri, the Sun a yellow star of magnitude 0.4.
        </Equation>
        <Equation
          title="A comet’s brightness"
          cite="sbdb"
          code="web/src/core/comets.ts (cometMagnitude)"
          math={math(
            row(
              mi('m'),
              mo('='),
              sub(mi('M'), mn('1')),
              mo('+'),
              mn('5'),
              log10(mi('Δ')),
              mo('+'),
              sub(mi('K'), mn('1')),
              log10(mi('r')),
            ),
          )}
          symbols={
            <>
              M₁ and K₁ SBDB’s total-magnitude parameters; r the distance from the Sun and Δ from the
              observer, in AU, Δ held at 1.
            </>
          }
        >
          It sets how bright a comet’s dot is drawn as it nears the Sun. Where SBDB gives no M₁, the median of
          those it gives stands in; where no K₁, 10.
        </Equation>
        <Equation
          title="An asteroid’s size from its brightness"
          code="web/src/ui/about/sentences.ts (diameterKm)"
          math={math(
            row(
              mi('D'),
              mo('='),
              frac(t('1329 ~km'), sqrt(mi('p'))),
              sup(mn('10'), row(mo('−'), mi('H'), mo('/'), mn('5'))),
            ),
          )}
          symbols={<>D the diameter; H the absolute magnitude; p the geometric albedo.</>}
        >
          Used only for the sizes this text gives the belt (“down to about 4 km across”), at an albedo of 0.1:
          the dark C-types are at 0.05 and the stony S-types at 0.25, so any one size for an H is a factor of
          1.5 either way, and is said as “about”.
        </Equation>

        <Sub section="physics" id="colour">
          Star colour
        </Sub>
        <Equation
          title="Temperature from colour index"
          cite="ballesteros2012"
          code="web/src/scene/blackbody.ts (colorIndexToTemperature)"
          math={math(
            row(
              mi('T'),
              mo('='),
              t('4600 ~K'),
              paren(
                frac(mn('1'), row(mn('0.92'), paren(t('B − V')), mo('+'), mn('1.7'))),
                mo('+'),
                frac(mn('1'), row(mn('0.92'), paren(t('B − V')), mo('+'), mn('0.62'))),
              ),
            ),
          )}
          symbols={<>B−V the star’s measured Johnson colour index; T its effective temperature.</>}
        >
          Checked on the Sun: B−V 0.65 gives 5,778 K against a measured 5,772 K, from a formula that knows
          nothing about the Sun. The index is clamped to −0.4…4 first, since past B−V = −0.67 the formula
          turns negative.
        </Equation>
        <Equation
          title="Planck’s law, through the eye"
          cite="wyman2013"
          code="web/src/scene/blackbody.ts"
          math={math(
            row(
              sub(mi('B'), mi('λ')),
              paren(mi('T')),
              mo('='),
              frac(row(mn('2'), mi('h'), sup(mi('c'), mn('2'))), sup(mi('λ'), mn('5'))),
              frac(
                mn('1'),
                row(
                  sup(mi('e'), row(mi('h'), mi('c'), mo('/'), mi('λ'), mi('k'), mi('T'))),
                  mo('−'),
                  mn('1'),
                ),
              ),
              gap(),
              mi('X'),
              mo('='),
              row(
                subsup(mo('∫'), t('360 ~nm'), t('830 ~nm')),
                sub(mi('B'), mi('λ')),
                mover('x', '‾'),
                mi('dλ'),
              ),
            ),
          )}
          symbols={
            <>
              B<sub>λ</sub> the radiance of a blackbody at wavelength λ; h, c and k Planck’s constant, the
              speed of light and Boltzmann’s; x̄, ȳ, z̄ the CIE 1931 observer’s curves, giving X, Y and Z.
            </>
          }
        >
          The spectrum is weighed by the measured response of human colour vision, scaled to unit luminance (Y
          = 1) and turned into sRGB by the standard matrix — so a red star and a blue star of the same
          magnitude read as equally bright. A 20,000 K blue is bluer than any screen primary and is clamped,
          so the hottest stars render slightly less blue than they are. The same path colours the Sun, its
          glare, Alpha Centauri, and the city lights’ sodium amber.
        </Equation>

        <Sub section="physics" id="sun">
          The Sun’s light
        </Sub>
        <Equation
          title="The photosphere’s radiance"
          code="web/src/scene/solarGlare.ts"
          math={math(
            row(
              mi('L'),
              mo('='),
              frac(row(mi('σ'), sup(mi('T'), mn('4'))), mi('π')),
              mo('≈'),
              t('2.0 × 10^7 ~W ~m^−2 ~sr^−1'),
              gap(),
              mtext('at T = 5,772 K'),
            ),
          )}
          symbols={<>σ the Stefan–Boltzmann constant; T the Sun’s effective temperature.</>}
        >
          154,000 times the radiance of the sunlit Earth this scene’s exposure is set for — why the disc is
          drawn overexposed:{' '}
          <Xref to="choices" sub="sun">
            Choices › The Sun
          </Xref>
          .
        </Equation>
        <Equation
          title="Glare: the CIE disability-glare equation"
          cite="cie135"
          code="web/src/scene/solarGlare.ts"
          math={math(
            row(
              frac(sub(mi('L'), up('veil')), sub(mi('E'), up('glare'))),
              mo('='),
              frac(mn('10'), sup(mi('θ'), mn('3'))),
              mo('+'),
              frac(mn('5'), sup(mi('θ'), mn('2'))),
              gap(),
              sub(mi('E'), up('glare')),
              mo('='),
              mi('L'),
              mi('π'),
              fn('sin'),
              sup(mi('θ'), mn('2')),
              sub(mi('θ'), mi('R')),
            ),
          )}
          symbols={
            <>
              θ the angle from the Sun, degrees; θ<sub>R</sub> the Sun’s angular radius; L its radiance; E the
              illuminance its disc delivers — the projected solid angle, which is the inverse square law
              written without assuming the source is a point.
            </>
          }
        >
          The Sun has glare, and its shape is a measurement of the eye rather than a bloom filter. Most of
          what you see around the Sun is not coming from the Sun’s direction at all — it is its light
          scattered sideways inside whatever is looking. That scatter has been measured for a century, and the
          CIE disability-glare equation describes it: the veil falls as 10/θ³ + 5/θ², with θ in degrees. It
          follows the inverse square law on its own, so the halo is 3.9° wide from Mercury’s orbit, 1.8° from
          Earth’s and 0.34° from Saturn’s with nothing animating it, and it takes the Sun’s own colour because
          scattered sunlight is still sunlight.
          <Why>
            The Sun’s glare has no brightness setting at all: the veil is the illuminance the disc delivers, E
            = L·π·sin²θ, so it is tied to whatever exposure the disc is drawn at and cannot drift from it.
          </Why>{' '}
          What still differs from NASA’s render is how fast it falls — theirs goes as θ⁻³·⁵ where the eye’s
          equation is between θ⁻³ and θ⁻², so their glow ends at 1.72° from Earth’s distance and this one
          reaches 3.6°. An optical instrument is tighter than an eye: most of the eye’s veil is scattered
          inside the eye itself, and a lens has no retina.
        </Equation>
        <Equation
          title="Limb darkening"
          code="web/src/scene/starDisc.ts"
          math={math(
            row(
              frac(row(mi('I'), paren(mi('μ'))), row(mi('I'), paren(mn('1')))),
              mo('='),
              t('1 − u ( 1 − μ )'),
              gap(),
              t('u = 0.6'),
            ),
          )}
          symbols={<>μ the cosine of the angle from the disc’s centre; I the brightness there.</>}
        >
          A star’s edge is darker than its middle: there the line of sight runs through the upper, cooler
          photosphere. u = 0.6 is the Sun’s own in the visible (the classical Eddington value, close to
          measured solar coefficients near 550 nm); Alpha Centauri’s three take it as theirs.
        </Equation>

        <Sub section="physics" id="earth">
          Earth’s air and sea
        </Sub>
        <Equation
          title="Rayleigh scattering"
          cite="peckReeder1972"
          code="web/src/scene/atmosphere.ts"
          math={math(
            row(
              mi('β'),
              paren(mi('λ')),
              mo('='),
              frac(
                row(
                  mn('8'),
                  sup(mi('π'), mn('3')),
                  sup(paren(sup(mi('n'), mn('2')), mo('−'), mn('1')), mn('2')),
                ),
                row(mn('3'), mi('N'), sup(mi('λ'), mn('4'))),
              ),
              mi('K'),
              gap(),
              mi('P'),
              paren(mi('θ')),
              mo('='),
              frac(mn('3'), row(mn('16'), mi('π'))),
              paren(t('1 + cos'), sup(mi('θ'), mn('2'))),
            ),
          )}
          symbols={
            <>
              β the scattering coefficient at sea level; n the refractive index of air at wavelength λ (Peck
              and Reeder’s dispersion); N Loschmidt’s number; K = 1.048 the King correction for non-spherical
              molecules; P the phase function; the density falls off with an 8.5 km scale height.
            </>
          }
        >
          Earth has a real sky. Rayleigh scattering, ray-marched through an exponential atmosphere, with the
          scattering coefficient computed from the refractive index of air rather than picked to look right —
          it reproduces the published optical depth of Earth’s atmosphere at 550 nm to three parts in a
          thousand (0.0976 against 0.0973). That is why the haze is strongest at the limb, where a ray crosses
          seventy times more air than it does looking straight down, and why the band above the terminator
          goes orange: on a path that long, blue has already been scattered away. Sixteen samples along each
          view ray; the path to the Sun is the Chapman function, in closed form.
        </Equation>
        <Items>
          <Item title="Sunsets">
            Sunsets, from the same physics rather than from a colour ramp. The sunlight reaching the ground
            and the clouds is attenuated by the air it came down through, so it loses a fifth of its blue at
            noon and almost all of it near the terminator: the light there is rgb(255, 106, 3) at a quarter of
            its strength. That is what turns the clouds amber on the daylit side of the line.
          </Item>
          <Item title="Single scattering only">
            The sky is single-scattering only, and the cost of that is measurable rather than theoretical:
            held against NASA’s render, the last stretch of the fade into night — from a tenth of full
            brightness down to black — takes 4.5% of Earth’s radius here against their 9.9%. The twilight glow
            past the terminator comes out about six times too faint and far too red, where theirs is a neutral
            grey. Both are the signature of the same gap: after several bounces a spectrum flattens, and light
            that a single-scattering model throws away is still in the air. Closing it needs precomputed
            multiple scattering, which is a piece of work in its own right.
          </Item>
          <Item title="No aerosols, ozone or refraction">
            It also has no aerosols, no ozone and no refraction, so there is none of the white haze that hangs
            low in a real atmosphere and the Sun sets about half a degree early.
            <Why>
              Aerosols are the reason the easy one is missing: their loading varies tenfold with place and
              season, so it would be the first fitted number in a model that currently has none.
            </Why>
          </Item>
          <Item title="City lights at astronomical twilight">
            Earth’s city lights come up where the Sun is more than 18° below the horizon — the end of
            astronomical twilight — so they trail the terminator by about 2000 km instead of switching on at
            it. VIIRS Day/Night Band, 2012.
          </Item>
        </Items>
        <Equation
          title="The sea’s roughness and reflectance"
          cite="coxMunk1954"
          code="web/src/scene/earthExtras.ts"
          math={math(
            row(
              sup(mi('σ'), mn('2')),
              mo('='),
              t('0.003 + 0.00512 W'),
              gap(),
              mtext('roughness'),
              mo('='),
              sup(paren(sup(mi('σ'), mn('2'))), mn('1/4')),
              gap(),
              sub(mi('F'), mn('0')),
              mo('='),
              sup(paren(frac(t('n − 1'), t('n + 1'))), mn('2')),
            ),
          )}
          symbols={
            <>
              σ² the mean square slope of the sea surface, from its sun glitter; W the wind speed, the global
              ocean mean of 7 m/s, giving 0.444; F₀ the reflectance at normal incidence, 0.020 for water’s n =
              1.333.
            </>
          }
        >
          Earth’s oceans are as rough as Cox and Munk measured the sea to be from its sun glitter, and reflect
          at water’s refractive index rather than the generic one every renderer assumes. That is what puts a
          real glint on the water and none on the land.
        </Equation>

        <Sub section="physics" id="saturn">
          Saturn’s shadows
        </Sub>
        <Items>
          <Item title="Saturn on its rings">
            Saturn casts its real shadow across the rings, from its oblate silhouette. With the Sun near the
            ring plane, as now, it reaches about 431,000 km and crosses the whole system; with the rings wide
            open it barely reaches them.
          </Item>
          <Item title="The rings on Saturn">
            The rings cast their real shadow back onto Saturn, from their own optical depth along the Sun’s
            path — so the band sweeps across the planet over its 29.5-year year and swaps hemispheres at
            equinox. How dark it gets is calibrated rather than derived: the light reaching a shadowed point
            indirectly is one constant standing in for ringshine and diffuse transmission.
          </Item>
        </Items>

        <Sub section="physics" id="satellites">
          Satellites: SGP4
        </Sub>
        <Equation
          title="From SGP4’s frame to the scene’s"
          cite={['vallado2006', 'meeus1998', 'lieske1977']}
          code={['web/src/core/teme.ts', 'web/src/core/satelliteBodies.ts']}
          math={math(
            row(
              sub(mi('𝐫'), mtext('J2000')),
              mo('='),
              mi('P'),
              mi('N'),
              sub(up('R'), mn('3')),
              paren(mo('−'), sub(mi('E'), mi('q'))),
              sub(mi('𝐫'), mtext('TEME')),
            ),
          )}
          symbols={
            <>
              TEME the true-equator, mean-equinox frame SGP4 answers in; R₃(−E<sub>q</sub>) the turn by its
              equation of the equinoxes; N the IAU 1980 nutation (its 30 largest terms of 106, as Meeus
              tabulates them); P the IAU 1976 precession — then the IAU 1976 obliquity into the ecliptic of
              J2000.
            </>
          }
        >
          The named satellites are run through SGP4 itself, by satellite.js; the rest are dots placed by the
          graphics card from SGP4’s secular terms alone, solving Kepler’s equation as the belt does. How well
          each holds:{' '}
          <Xref to="measured" sub="satellites">
            Measured › Earth satellites
          </Xref>
          .
        </Equation>

        <Sub section="physics" id="black-holes">
          Black holes
        </Sub>
        <Equation
          title="The Schwarzschild radius"
          code="web/src/core/blackHoles.ts (schwarzschildRadiusKm)"
          math={math(
            row(
              sub(mi('r'), mi('s')),
              mo('='),
              frac(row(mn('2'), mi('G'), mi('M')), sup(mi('c'), mn('2'))),
              mo('≈'),
              t('2.953 ~km'),
              mo('×'),
              frac(mi('M'), sub(mi('M'), mo('☉'))),
            ),
          )}
          symbols={<>M the black hole’s mass; G the gravitational constant; c the speed of light.</>}
        >
          The horizon of a black hole that does not spin, drawn as a sphere at true size. Why not spinning:{' '}
          <Xref to="estimated" sub="black-holes">
            Not known › Black holes
          </Xref>
          .
        </Equation>
        <Equation
          title="The shadow: light that falls in"
          code="web/src/core/blackHoles.ts"
          math={math(
            row(
              sub(mi('b'), mi('c')),
              mo('='),
              frac(row(sqrt(mn('27')), mi('G'), mi('M')), sup(mi('c'), mn('2'))),
              mo('='),
              frac(sqrt(mn('27')), mn('2')),
              sub(mi('r'), mi('s')),
              mo('≈'),
              mn('2.6'),
              sub(mi('r'), mi('s')),
            ),
          )}
          symbols={
            <>
              b<sub>c</sub> the closest a passing ray can aim at the centre and still escape.
            </>
          }
        >
          What one sees is larger than the horizon: light passing within 2.6 times its radius falls in, so the
          black disc drawn is this shadow, not the horizon. For Sgr A* it is 0.22 AU in radius, and 53.3
          microarcseconds across from Earth at GRAVITY’s mass and distance — the Event Horizon Telescope
          measured a ring of 51.8 ± 2.3 <Cite k="eht2022" />. The horizon still sets how close the camera can
          go.
        </Equation>
        <Equation
          title="Light’s path past a black hole"
          cite={['darwin1959', 'carlson1995']}
          code="web/src/core/schwarzschildLens.ts"
          math={math(
            row(
              sup(paren(frac(row(mi('d'), mi('u')), row(mi('d'), mi('φ')))), mn('2')),
              mo('='),
              frac(mn('1'), sup(mi('b'), mn('2'))),
              mo('−'),
              sup(mi('u'), mn('2')),
              paren(row(mn('1'), mo('−'), sub(mi('r'), mi('s')), mi('u'))),
              mtext('  '),
              mi('u'),
              mo('='),
              frac(mn('1'), mi('r')),
            ),
          )}
          symbols={
            <>
              r the distance from the centre, φ the angle round it, b the impact parameter: how far off centre
              the ray is aimed.
            </>
          }
        >
          The photon’s orbit in the Schwarzschild metric, solved exactly with elliptic integrals rather than by
          stepping it, so it holds right up to the shadow’s edge, where light circles the hole several times.
          How much a ray is bent comes from it — far out it tends to 2r<sub>s</sub>/b, Einstein’s — and it is
          checked against that weak-field series <Cite k="keetonPetters2005" />, against the strong-field limit
          near the edge <Cite k="bozza2002" />, and against direct integration. Around the hole the sky is drawn
          bent by it: each star twice, once outside the Einstein ring and once, fainter and flipped, between
          the ring and the shadow, each brighter or fainter by the solid angle its image covers{' '}
          <Cite k="paczynski1986" />; and the galaxy’s glow bent into the Einstein ring and the thinner rings
          inside it.
        </Equation>
        <Equation
          title="The shadow from where the camera stands"
          cite={['synge1966', 'perlick2004']}
          code="web/src/core/schwarzschildLens.ts"
          math={math(
            row(
              fn('sin'),
              sub(mi('θ'), up('sh')),
              mo('='),
              frac(sub(mi('b'), mi('c')), mi('r')),
              sqrt(row(mn('1'), mo('−'), frac(sub(mi('r'), mi('s')), mi('r')))),
            ),
          )}
          symbols={
            <>
              θ<sub>sh</sub> the shadow’s angular radius for a camera at rest at distance r from the centre.
            </>
          }
        >
          The lens is worked out for the camera where it really is, a few horizons out or tens of parsecs
          away, not as if it were infinitely far: inside the photon sphere, at 1.5 r<sub>s</sub>, the shadow
          fills more than half the sky.
        </Equation>
        <Items>
          <Item title="Spin: none">
            The holes are lensed as non-spinning (Schwarzschild). A spinning hole’s shadow is slightly smaller
            and flattened on one side, and the EHT’s models for Sgr A* disfavour no spin.{' '}
            <Xref to="estimated" sub="black-holes">
              Not known › Black holes
            </Xref>
          </Item>
          <Item title="Only the sky is bent">
            S2, the stars of BH1 and BH3, the scale rings and any body past the hole are drawn unbent; sources
            are treated as infinitely far behind it, under 1% wrong where it shows.
          </Item>
          <Item title="A camera at rest">
            No aberration or Doppler shift from the camera’s motion, and no blueshift for hovering near the
            hole — 2% at 30 r<sub>s</sub>, 73% at the photon sphere.
          </Item>
          <Item title="Looping images">
            Images of the sky that loop round the hole are drawn for the galaxy’s glow, not for single stars.
            Close in, the glow is read from a 1024-pixel cube map and is softer than elsewhere.
          </Item>
          <Item title="Not drawn: S2’s precession">
            S2 follows its measured orbit as a Kepler ellipse, and the 12 arcminutes a turn it precesses —
            measured by GRAVITY, as general relativity predicts — is not drawn.
          </Item>
        </Items>

        <Sub section="physics" id="galaxy">
          The galaxy
        </Sub>
        <Equation
          title="Spiral arms: log-periodic spirals"
          cite="reid2019"
          code="web/src/core/milkyWay.ts"
          math={math(
            row(
              fn('ln'),
              paren(frac(mi('R'), sub(mi('R'), up('kink')))),
              mo('='),
              mo('−'),
              paren(t('β −'), sub(mi('β'), up('kink'))),
              fn('tan'),
              mi('ψ'),
            ),
          )}
          symbols={
            <>
              R the distance from the Galactic centre; β the Galactocentric azimuth, zero toward the Sun; ψ
              the pitch angle, one value up to the arm’s kink and another past it.
            </>
          }
        >
          Seven arms, each with its own kink, pitch angles and width, from Reid et al.’s Table 2.
        </Equation>
        <Prose>
          The hydrogen clouds’ pink is hydrogen’s own light, its two brightest lines at the ratio atomic
          physics gives: H-alpha and H-beta at the Balmer decrement of 2.86 (Osterbrock &amp; Ferland 2006).
          The dust dims only what lies behind it: the galaxy is drawn in six slabs of distance from the
          camera, far to near, so the dust on the far side of the centre leaves it alone and the dust in front
          of it crosses it. Within a slab, a few thousand light years deep, stars and dust are not ordered.
          <Cite k="osterbrockFerland2006" />
        </Prose>
      </>
    );
  },
};
