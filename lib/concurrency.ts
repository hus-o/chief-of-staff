export function withConcurrency<T>(
  limit: number,
  tasks: (() => Promise<T>)[]
): Promise<T[]> {
  let active = 0
  const queue: (() => void)[] = []

  const run = <R>(fn: () => Promise<R>): Promise<R> =>
    new Promise((resolve, reject) => {
      const execute = () => {
        active++
        fn()
          .then(resolve, reject)
          .finally(() => {
            active--
            if (queue.length > 0) queue.shift()!()
          })
      }
      active < limit ? execute() : queue.push(execute)
    })

  return Promise.all(tasks.map((task) => run(task)))
}
