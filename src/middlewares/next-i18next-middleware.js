import koaI18nextMiddleware from 'koa-i18next-middleware-async'
import { parse } from 'url'
import pathMatch from 'path-match'

import { forceTrailingSlash, lngPathDetector } from '../utils'
import { localeSubpathOptions } from '../config/default-config'

const route = pathMatch()

export default function (nexti18next) {
  const { config, i18n } = nexti18next
  const { allLanguages, ignoreRoutes, localeSubpaths } = config

  const ignoreRegex = new RegExp(`^\/(?!${ignoreRoutes.map(x => x.replace('/', '')).join('|')}).*$`)
  const ignoreRoute = route(ignoreRegex)
  const isI18nRoute = url => ignoreRoute(url)

  const localeSubpathRoute = route(`/:lng(${allLanguages.join('|')})/*`)

  const middleware = []

  // If not using server side language detection,
  // we need to manually set the language for
  // each request
  if (!config.serverLanguageDetection) {
    middleware.push(async ({ request: req }, next) => {
      if (isI18nRoute(req.url)) {
        req.lng = config.defaultLanguage
      }
      await next()
    })
  }

  middleware.push(koaI18nextMiddleware.getHandler(i18n, {
    ignoreRoutes,
    locals: 'req',
  }))

  if (localeSubpaths !== localeSubpathOptions.NONE) {
    middleware.push(
      async ({ request: req, response: res }, next) => {
        if (isI18nRoute(req.url)) {
          const { pathname } = parse(req.url)

          if (allLanguages.some(lng => pathname === `/${lng}`)) {
            forceTrailingSlash(req, res, pathname.slice(1))
            return
          }

          lngPathDetector(req, res)

          const params = localeSubpathRoute(req.url)

          if (params !== false) {
            const { lng } = params
            req.query = { ...req.query, lng }
            req.url = req.url.replace(`/${lng}`, '')
          }
        }
        await next()
      },
    )
  }

  return middleware
}
